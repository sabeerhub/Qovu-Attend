-- UniAttend — v0.9.0 migration: course_students (Student roster)
--
-- One row per registered student in a course: a registration number
-- and an optional name. This closes the hole where ANY registration
-- number could submit attendance because there was nothing to check
-- it against (master prompt Rule 4: only registration numbers
-- registered in the selected course may submit).
--
-- Registration numbers are stored NORMALIZED (trimmed + uppercased)
-- by a trigger, so "u19/cs/001" and "U19/CS/001" are the same
-- student — the same normalization the client and the Edge Function
-- apply. One student appears once per course (unique constraint);
-- the same student may be on several courses' rosters, and
-- attendance is calculated independently per course.
--
-- Writes go through the normal authenticated client under the RLS
-- policies below (same ownership pattern as courses): a lecturer
-- reads/writes only rows for courses they are assigned to (a
-- course-level assignment, or a department-level assignment with a
-- null course_id). There is no service-role write path here.
--
-- Deleting a course deletes its roster (ON DELETE CASCADE): a roster
-- row is meaningless without its course.
--
-- UNVERIFIED: this migration has NOT been applied to a live Supabase
-- project yet. Apply in the SQL Editor (it is DDL + RLS, so the
-- publishable key cannot run it), then confirm the course_students
-- table exists before relying on the Students tab or the roster
-- check in attendance-submit.

-- ------------------------------------------------------------ table
create table public.course_students (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  reg_number text not null check (char_length(reg_number) between 1 and 100),
  student_name text check (student_name is null or char_length(student_name) <= 100),
  created_at timestamptz not null default now(),
  -- One student appears once per course.
  constraint course_students_unique unique (course_id, reg_number)
);

create index course_students_course_id_idx on public.course_students (course_id);

-- ------------------------------------------------------------ normalize
-- Trim + uppercase the registration number on every write, and trim
-- the name (empty becomes null). The CHECK above runs after this
-- trigger, so it always sees the normalized value.
create or replace function public.normalize_course_student()
returns trigger
language plpgsql
as $$
begin
  new.reg_number := upper(btrim(new.reg_number));
  new.student_name := nullif(btrim(new.student_name), '');
  return new;
end;
$$;

create trigger course_students_normalize
  before insert or update on public.course_students
  for each row execute function public.normalize_course_student();

-- ------------------------------------------------------------ RLS
alter table public.course_students enable row level security;

-- A lecturer reads only rows for courses they are assigned to
-- (course-level assignment, or department-level assignment with a
-- null course_id) — the same ownership rule as courses.
create policy "course_students_own_select"
  on public.course_students for select
  using (
    exists (
      select 1
      from public.lecturer_assignments a
      join public.courses c on c.id = course_students.course_id
      where a.lecturer_id = public.current_lecturer_id()
        and a.department_id = c.department_id
        and (a.course_id is null or a.course_id = c.id)
    )
  );

create policy "course_students_own_insert"
  on public.course_students for insert
  with check (
    exists (
      select 1
      from public.lecturer_assignments a
      join public.courses c on c.id = course_students.course_id
      where a.lecturer_id = public.current_lecturer_id()
        and a.department_id = c.department_id
        and (a.course_id is null or a.course_id = c.id)
    )
  );

create policy "course_students_own_update"
  on public.course_students for update
  using (
    exists (
      select 1
      from public.lecturer_assignments a
      join public.courses c on c.id = course_students.course_id
      where a.lecturer_id = public.current_lecturer_id()
        and a.department_id = c.department_id
        and (a.course_id is null or a.course_id = c.id)
    )
  )
  with check (
    exists (
      select 1
      from public.lecturer_assignments a
      join public.courses c on c.id = course_students.course_id
      where a.lecturer_id = public.current_lecturer_id()
        and a.department_id = c.department_id
        and (a.course_id is null or a.course_id = c.id)
    )
  );

create policy "course_students_own_delete"
  on public.course_students for delete
  using (
    exists (
      select 1
      from public.lecturer_assignments a
      join public.courses c on c.id = course_students.course_id
      where a.lecturer_id = public.current_lecturer_id()
        and a.department_id = c.department_id
        and (a.course_id is null or a.course_id = c.id)
    )
  );
