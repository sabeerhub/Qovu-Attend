-- UniAttend — v0.8.0 migration: My Lecture Plan
--
-- A lecturer's own weekly timetable: one row per planned lecture
-- (course + weekday + start time). In Nigerian universities a
-- lecturer teaches across departments and levels, so the plan is
-- built around the lecturer, not the department — and each lecturer
-- sees ONLY their own plan.
--
-- Writes go through ONE server-side function only:
-- public.create_lecture_plan(...). There is NO direct client insert
-- policy on lecture_plans — the function validates everything
-- server-side (the course must exist AND the caller must be
-- assigned to it) and inserts atomically. Updates and deletes are
-- RLS-guarded to the owner's own rows; the update policy's WITH
-- CHECK also re-verifies course ownership, so a lecturer can never
-- repoint an entry at a course they are not assigned to.
--
-- Deleting a course deletes its plan entries (ON DELETE CASCADE):
-- a planned lecture is meaningless without its course.
--
-- UNVERIFIED: this migration has NOT been applied to a live Supabase
-- project yet. Apply in the SQL Editor (it is DDL + RLS, so the
-- publishable key cannot run it), then confirm
-- create_lecture_plan exists before relying on the "My Plan" screen.

-- ------------------------------------------------------------ table
create table public.lecture_plans (
  id uuid primary key default gen_random_uuid(),
  lecturer_id uuid not null references public.lecturer_profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  -- Weekday of the planned lecture: 1 = Monday .. 6 = Saturday.
  -- Nigerian universities lecture Monday to Saturday; Sunday (7)
  -- is not a teaching day and is rejected.
  day_of_week smallint not null check (day_of_week between 1 and 6),
  start_time time not null,
  end_time time,
  -- Free-text venue, e.g. "LT1" or "New Lecture Theatre".
  room text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lecture_plans_end_after_start_check
    check (end_time is null or end_time > start_time),
  constraint lecture_plans_room_length_check
    check (room is null or char_length(room) <= 80),
  -- The same lecture cannot be planned twice.
  constraint lecture_plans_unique
    unique (lecturer_id, course_id, day_of_week, start_time)
);

create index lecture_plans_lecturer_id_idx on public.lecture_plans (lecturer_id);
create index lecture_plans_course_id_idx on public.lecture_plans (course_id);

-- ------------------------------------------------------------ RLS
alter table public.lecture_plans enable row level security;

-- A lecturer reads only their own plan rows.
create policy "lecture_plans_own_read"
  on public.lecture_plans for select
  using (lecturer_id = public.current_lecturer_id());

-- No insert policy: inserts go through create_lecture_plan only.

-- A lecturer updates only their own rows, and the new row must
-- still point at a course they are assigned to.
create policy "lecture_plans_own_update"
  on public.lecture_plans for update
  using (lecturer_id = public.current_lecturer_id())
  with check (
    lecturer_id = public.current_lecturer_id()
    and exists (
      select 1
      from public.lecturer_assignments a
      join public.courses c on c.id = lecture_plans.course_id
      where a.lecturer_id = public.current_lecturer_id()
        and a.department_id = c.department_id
        and (a.course_id is null or a.course_id = c.id)
    )
  );

-- A lecturer deletes only their own rows.
create policy "lecture_plans_own_delete"
  on public.lecture_plans for delete
  using (lecturer_id = public.current_lecturer_id());

-- --------------------------------------------- create_lecture_plan
-- Creates one plan entry for the caller, atomically. All validation
-- is server-side; the client only validates the same rules for
-- field-level UX (src/lib/lecturePlan.ts). Error messages are
-- prefixed with a stable code (e.g. "lecture_plan_duplicate: ...")
-- so the client can map them to plain-language messages without
-- parsing free text.
create or replace function public.create_lecture_plan(
  p_course_id uuid,
  p_day_of_week smallint,
  p_start_time time,
  p_end_time time,
  p_room text
)
returns public.lecture_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lecturer_id uuid;
  v_course public.courses;
  v_room text;
  v_plan public.lecture_plans;
begin
  -- The caller must have a lecturer profile. The id comes from the
  -- auth session, never from an argument.
  select id into v_lecturer_id
  from public.lecturer_profiles
  where user_id = auth.uid()
  limit 1;
  if v_lecturer_id is null then
    raise exception 'lecturer_profile_not_found: your account has no lecturer profile yet.';
  end if;

  if p_day_of_week is null or p_day_of_week < 1 or p_day_of_week > 6 then
    raise exception 'day_of_week_invalid: choose a day from Monday to Saturday.';
  end if;
  if p_start_time is null then
    raise exception 'start_time_required: choose a lecture start time.';
  end if;
  if p_end_time is not null and p_end_time <= p_start_time then
    raise exception 'end_time_invalid: the end time must be after the start time.';
  end if;

  v_room := nullif(btrim(coalesce(p_room, '')), '');
  if v_room is not null and char_length(v_room) > 80 then
    raise exception 'room_too_long: the room name must be 80 characters or fewer.';
  end if;

  select * into v_course from public.courses where id = p_course_id;
  if v_course is null then
    raise exception 'course_not_found: the selected course does not exist.';
  end if;

  -- The caller must be assigned to this course (course-level
  -- assignment, or department-level assignment with a null
  -- course_id) — the same rule the session policies use.
  if not exists (
    select 1 from public.lecturer_assignments a
    where a.lecturer_id = v_lecturer_id
      and a.department_id = v_course.department_id
      and (a.course_id is null or a.course_id = v_course.id)
  ) then
    raise exception 'course_not_assigned: you are not assigned to this course.';
  end if;

  begin
    insert into public.lecture_plans (lecturer_id, course_id, day_of_week, start_time, end_time, room)
    values (v_lecturer_id, p_course_id, p_day_of_week, p_start_time, p_end_time, v_room)
    returning * into v_plan;
  exception when unique_violation then
    -- Backstop for the unique (lecturer_id, course_id, day_of_week,
    -- start_time) constraint: the same lecture, same day, same time.
    raise exception 'lecture_plan_duplicate: this lecture is already in your plan for this day and time.';
  end;

  return v_plan;
end;
$$;

-- Functions are executable by PUBLIC by default; restrict this one
-- to signed-in users only.
revoke execute on function public.create_lecture_plan(uuid, smallint, time, time, text) from public;
grant execute on function public.create_lecture_plan(uuid, smallint, time, time, text) to authenticated;
