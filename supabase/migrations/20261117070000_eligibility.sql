-- UniAttend — v0.11.0 migration: eligibility (the 75% check)
--
-- For each course, every student gets an attendance percentage:
-- sessions attended divided by sessions actually held. The bar is
-- 75% by default and the lecturer can change it per course
-- (eligibility_threshold on courses, 0–100).
--
-- What counts as "held": only a session that is finished and
-- locked — Finalized or Archived. Draft, Active and Closed
-- sessions do not count yet, because attendance can still change
-- in them. There is NO cancelled session status in this codebase
-- (the lifecycle is draft → active → closed → finalized →
-- archived), so there is nothing extra to exclude: anything that
-- is not Finalized or Archived simply does not count.
--
-- The percentage is computed in the app (src/lib/eligibility.ts),
-- never stored: a stored percentage would go stale the moment a
-- session is finalized. The exact, unrounded percentage decides —
-- 74.6% is below a 75% bar. A student added by hand by the
-- lecturer counts as present, the same as a verified one; pending
-- records do not count as present.
--
-- Changing the bar goes through ONE server-side function only:
-- public.set_eligibility_threshold(...). There is NO direct client
-- update policy on courses — the function validates everything
-- server-side and refuses any course the caller is not assigned
-- to. The CHECK constraint below is the backstop for the range.
--
-- UNVERIFIED: this migration has NOT been applied to a live
-- Supabase project yet. Apply in the SQL Editor (it is DDL + a
-- function, so the publishable key cannot run it), then confirm
-- the eligibility_threshold column exists before relying on the
-- Eligibility view or the threshold control.

-- ------------------------------------------------------------ column
-- Default 75: every existing course gets the default bar, and a
-- new course starts at 75 until the lecturer changes it.
alter table public.courses
  add column if not exists eligibility_threshold integer not null default 75;

alter table public.courses
  add constraint courses_eligibility_threshold_range
  check (eligibility_threshold between 0 and 100);

-- --------------------------------------------- set_eligibility_threshold
-- Changes one course's eligibility bar. All validation is
-- server-side; the client only validates the same rules for
-- field-level UX (src/lib/eligibility.ts).
-- Error messages are prefixed with a stable code (e.g.
-- "course_not_assigned: ...") so the client can map them to
-- plain-language messages without parsing free text.
create or replace function public.set_eligibility_threshold(
  p_course_id uuid,
  p_threshold integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lecturer_id uuid;
  v_threshold integer;
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

  if p_threshold is null or p_threshold < 0 or p_threshold > 100 then
    raise exception 'threshold_invalid: the bar must be a whole number between 0 and 100.';
  end if;
  v_threshold := p_threshold;

  -- The course must exist and the caller must be assigned to it
  -- (course-level assignment, or department-level assignment with
  -- a null course_id) — the same ownership rule as courses.
  if not exists (select 1 from public.courses where id = p_course_id) then
    raise exception 'course_not_found: the selected course does not exist.';
  end if;
  if not exists (
    select 1
    from public.lecturer_assignments a
    join public.courses c on c.id = p_course_id
    where a.lecturer_id = v_lecturer_id
      and a.department_id = c.department_id
      and (a.course_id is null or a.course_id = c.id)
  ) then
    raise exception 'course_not_assigned: you are not assigned to this course.';
  end if;

  update public.courses
  set eligibility_threshold = v_threshold
  where id = p_course_id;

  return v_threshold;
end;
$$;

-- Functions are executable by PUBLIC by default; restrict this one
-- to signed-in users only.
revoke execute on function public.set_eligibility_threshold(uuid, integer) from public;
grant execute on function public.set_eligibility_threshold(uuid, integer) to authenticated;
