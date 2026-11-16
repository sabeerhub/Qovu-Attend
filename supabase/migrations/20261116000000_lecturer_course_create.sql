-- UniAttend — v0.4.0 migration: lecturer-created courses
--
-- SPEC CHANGE (2026-11-16, product owner decision): lecturers may
-- now create courses themselves, choosing the department and
-- semester. This overrides the Lecturer Dashboard spec v1.0 rule
-- that courses are admin-controlled. Creating a course also creates
-- the lecturer's own assignment to it, so the new course is visible
-- to them immediately.
--
-- Creation goes through ONE server-side function only:
-- public.create_lecturer_course(...). There is NO direct client
-- insert policy on courses or lecturer_assignments — the function
-- validates everything server-side and inserts the course and the
-- assignment atomically (a single transaction; either both rows
-- exist or neither does).
--
-- Reference data for the course form's pickers: any authenticated
-- lecturer may now READ departments, semesters, academic_sessions,
-- faculties and universities. Those tables are reference data, not
-- attendance data; nothing else is loosened. Attendance data
-- (sessions, records, audit logs, rooms) keeps the assignment-based
-- policies from the Phase 1 migration.
--
-- UNVERIFIED: this migration has NOT been applied to a live Supabase
-- project yet. Apply in the SQL Editor (it is DDL + RLS, so the
-- publishable key cannot run it), then confirm
-- create_lecturer_course exists before relying on the "New course"
-- form in the app.

-- --------------------------------------------- reference-data reads
-- Any signed-in lecturer may read the reference tables. Policies are
-- OR-ed in Postgres, so these add to — never replace — the
-- assignment-based policies from the Phase 1 migration.
create policy "departments_authenticated_read"
  on public.departments for select
  to authenticated
  using (true);

create policy "semesters_authenticated_read"
  on public.semesters for select
  to authenticated
  using (true);

create policy "academic_sessions_authenticated_read"
  on public.academic_sessions for select
  to authenticated
  using (true);

create policy "faculties_authenticated_read"
  on public.faculties for select
  to authenticated
  using (true);

create policy "universities_authenticated_read"
  on public.universities for select
  to authenticated
  using (true);

-- --------------------------------------------- create_lecturer_course
-- Creates a course and the caller's own assignment to it, atomically.
-- All validation is server-side; the client only validates the same
-- rules for field-level UX (src/lib/courseForm.ts).
-- Error messages are prefixed with a stable code (e.g.
-- "course_code_duplicate: ...") so the client can map them to
-- plain-language messages without parsing free text.
create or replace function public.create_lecturer_course(
  p_department_id uuid,
  p_semester_id uuid,
  p_code text,
  p_title text,
  p_level integer,
  p_credit_unit integer
)
returns public.courses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lecturer_id uuid;
  v_code text;
  v_title text;
  v_course public.courses;
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

  -- Normalise: code is stored upper-case, surrounding spaces removed.
  v_code := upper(btrim(coalesce(p_code, '')));
  v_title := btrim(coalesce(p_title, ''));

  if v_code = '' then
    raise exception 'course_code_required: enter a course code.';
  end if;
  if length(v_code) > 20 then
    raise exception 'course_code_too_long: course code must be 20 characters or fewer.';
  end if;
  if v_code !~ '^[A-Z0-9][A-Z0-9 ]*$' then
    raise exception 'course_code_invalid: course code may only contain letters, numbers and spaces.';
  end if;
  if v_title = '' then
    raise exception 'course_title_required: enter a course title.';
  end if;
  if length(v_title) > 120 then
    raise exception 'course_title_too_long: course title must be 120 characters or fewer.';
  end if;
  if p_level is null or p_level < 100 or p_level > 900 then
    raise exception 'course_level_invalid: level must be between 100 and 900.';
  end if;
  if p_credit_unit is not null and (p_credit_unit < 1 or p_credit_unit > 6) then
    raise exception 'course_credit_unit_invalid: credit units must be between 1 and 6.';
  end if;

  if not exists (select 1 from public.departments where id = p_department_id) then
    raise exception 'department_not_found: the selected department does not exist.';
  end if;
  if not exists (select 1 from public.semesters where id = p_semester_id) then
    raise exception 'semester_not_found: the selected semester does not exist.';
  end if;

  begin
    insert into public.courses (department_id, semester_id, code, title, level, credit_unit)
    values (p_department_id, p_semester_id, v_code, v_title, p_level, p_credit_unit)
    returning * into v_course;
  exception when unique_violation then
    -- Backstop for the unique (department_id, code, semester_id)
    -- constraint: same code, same department, same semester.
    raise exception 'course_code_duplicate: a course with this code already exists in this department for this semester.';
  end;

  -- The creator is assigned to their own course, role 'lecturer'.
  insert into public.lecturer_assignments (lecturer_id, department_id, course_id, role)
  values (v_lecturer_id, p_department_id, v_course.id, 'lecturer');

  return v_course;
end;
$$;

-- Functions are executable by PUBLIC by default; restrict this one
-- to signed-in users only.
revoke execute on function public.create_lecturer_course(uuid, uuid, text, text, integer, integer) from public;
grant execute on function public.create_lecturer_course(uuid, uuid, text, text, integer, integer) to authenticated;
