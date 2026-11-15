-- UniAttend seed data — EXAMPLE / TEST DATA ONLY.
-- The rows below are the examples from the Lecturer Dashboard spec
-- v1.0 (Faculty of Computing; Information Technology, Computer
-- Science, Software Engineering; CIT 301 Web Technology, CIT 305
-- Database Systems, CSC 301 Computer Architecture).
-- Run this ONLY against a test/staging project. Never run seed data
-- against production. It uses fixed UUIDs so it can be re-run
-- idempotently with ON CONFLICT DO NOTHING.

insert into public.universities (id, name, short_name)
values ('00000000-0000-0000-0000-000000000001', 'Example University', 'EXU')
on conflict (id) do nothing;

insert into public.faculties (id, university_id, name)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Faculty of Computing')
on conflict (id) do nothing;

insert into public.departments (id, faculty_id, name, code)
values
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'Information Technology', 'IT'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'Computer Science', 'CSC'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'Software Engineering', 'SEN')
on conflict (id) do nothing;

insert into public.academic_sessions (id, university_id, name, start_date, end_date)
values ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '2025/2026', '2025-09-01', '2026-07-31')
on conflict (id) do nothing;

insert into public.semesters (id, academic_session_id, name, start_date, end_date)
values ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000006', 'First Semester', '2025-09-01', '2026-01-31')
on conflict (id) do nothing;

insert into public.courses (id, department_id, semester_id, code, title, level, credit_unit)
values
  ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000007', 'CIT 301', 'Web Technology', 300, 3),
  ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000007', 'CIT 305', 'Database Systems', 300, 3),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000007', 'CSC 301', 'Computer Architecture', 300, 3)
on conflict (id) do nothing;

-- NOTE: lecturer_profiles / lecturer_assignments are NOT seeded here:
-- they reference auth.users ids, which only exist after a real
-- lecturer signs up in the Supabase project. Create them through the
-- app / admin flow instead.
