-- UniAttend — initial migration (Phase 1 foundation)
-- Creates all 12 tables from Lecturer Dashboard spec v1.0 §11.
-- Source of truth for the schema; docs/DATABASE_SCHEMA.md describes it.
--
-- UNVERIFIED: this migration has NOT been applied to a live Supabase
-- project yet. RLS policies below are sketched from the spec and must
-- be tested on a staging project with two lecturer accounts (one
-- assigned, one not) before pilot. Do not treat them as verified.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums
create type session_status as enum ('draft', 'active', 'closed', 'finalized', 'archived');

-- ------------------------------------------------------------ tables
create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  logo_url text,
  created_at timestamptz not null default now()
);

create table public.faculties (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculties (id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz not null default now()
);

create table public.lecturer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  staff_id text,
  created_at timestamptz not null default now()
);

create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  constraint academic_sessions_dates_check check (end_date > start_date)
);

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  academic_session_id uuid not null references public.academic_sessions (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  constraint semesters_dates_check check (end_date > start_date)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  semester_id uuid not null references public.semesters (id) on delete restrict,
  code text not null,
  title text not null,
  level integer not null,
  credit_unit integer,
  created_at timestamptz not null default now(),
  constraint courses_code_semester_unique unique (department_id, code, semester_id)
);

create table public.lecturer_assignments (
  id uuid primary key default gen_random_uuid(),
  lecturer_id uuid not null references public.lecturer_profiles (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  role text not null default 'lecturer' check (role in ('lecturer', 'admin')),
  created_at timestamptz not null default now(),
  constraint lecturer_assignments_unique unique (lecturer_id, department_id, course_id)
);

create table public.lecture_rooms (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments (id) on delete set null,
  name text not null,
  building text,
  capacity integer check (capacity is null or capacity > 0),
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lecturer_id uuid not null references public.lecturer_profiles (id) on delete cascade,
  semester_id uuid not null references public.semesters (id) on delete restrict,
  lecture_room_id uuid references public.lecture_rooms (id) on delete set null,
  title text not null,
  lecture_date date not null,
  week_number integer not null check (week_number between 1 and 15),
  headcount integer check (headcount is null or headcount >= 0),
  qr_expires_in_seconds integer not null default 300 check (qr_expires_in_seconds > 0),
  status session_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  registration_number text not null,
  student_name text,
  status text not null default 'verified'
    check (status in ('verified', 'manual', 'pending', 'rejected', 'suspicious')),
  verification_method text,
  manual_reason text,
  submitted_at timestamptz not null default now(),
  -- A student registration number must be unique within a session.
  constraint attendance_records_session_reg_unique unique (session_id, registration_number)
);

create table public.attendance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.attendance_sessions (id) on delete set null,
  record_id uuid references public.attendance_records (id) on delete set null,
  lecturer_id uuid references public.lecturer_profiles (id) on delete set null,
  action text not null,
  previous_status text,
  new_status text,
  reason text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------ indexes
create index attendance_sessions_course_id_idx on public.attendance_sessions (course_id);
create index attendance_sessions_lecturer_id_idx on public.attendance_sessions (lecturer_id);
create index attendance_sessions_semester_id_idx on public.attendance_sessions (semester_id);
create index attendance_records_session_id_idx on public.attendance_records (session_id);
create index courses_department_id_idx on public.courses (department_id);
create index lecturer_assignments_lecturer_id_idx on public.lecturer_assignments (lecturer_id);
create index attendance_audit_logs_session_id_idx on public.attendance_audit_logs (session_id);

-- ------------------------------------------------------------ RLS
-- RLS is enabled on every table. Policies below are a SKETCH from the
-- spec, not yet verified live. The core idea: a lecturer's access is
-- decided by a join through lecturer_assignments, keyed on
-- lecturer_profiles.user_id = auth.uid(). Before pilot, apply to a
-- staging project and test with an assigned and an unassigned
-- lecturer; adjust the policies until the unassigned lecturer sees
-- nothing. See docs/SECURITY_MODEL.md.

alter table public.universities enable row level security;
alter table public.faculties enable row level security;
alter table public.departments enable row level security;
alter table public.lecturer_profiles enable row level security;
alter table public.lecturer_assignments enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.semesters enable row level security;
alter table public.courses enable row level security;
alter table public.lecture_rooms enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_audit_logs enable row level security;

-- Helper: the calling user's lecturer profile id.
-- (Used by the policies below; re-evaluated per query.)
create or replace function public.current_lecturer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.lecturer_profiles where user_id = auth.uid() limit 1;
$$;

-- Own profile: read/update only.
create policy "lecturer_profiles_own"
  on public.lecturer_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Own assignments: read only (assignments are admin-controlled).
create policy "lecturer_assignments_own_read"
  on public.lecturer_assignments for select
  using (lecturer_id = public.current_lecturer_id());

-- Courses: readable only when assigned to the course, or to its
-- department with a null course_id (department-level assignment).
create policy "courses_assigned_read"
  on public.courses for select
  using (
    exists (
      select 1 from public.lecturer_assignments a
      where a.lecturer_id = public.current_lecturer_id()
        and a.department_id = courses.department_id
        and (a.course_id is null or a.course_id = courses.id)
    )
  );

-- Departments: readable only when assigned to the department.
create policy "departments_assigned_read"
  on public.departments for select
  using (
    exists (
      select 1 from public.lecturer_assignments a
      where a.lecturer_id = public.current_lecturer_id()
        and a.department_id = departments.id
    )
  );

-- Faculties / universities / academic sessions / semesters: readable
-- only when they contain something the lecturer is assigned to.
-- (Conservative sketch — verify on staging; tighten if needed.)
create policy "faculties_assigned_read"
  on public.faculties for select
  using (
    exists (
      select 1
      from public.departments d
      join public.lecturer_assignments a on a.department_id = d.id
      where d.faculty_id = faculties.id
        and a.lecturer_id = public.current_lecturer_id()
    )
  );

create policy "universities_assigned_read"
  on public.universities for select
  using (
    exists (
      select 1
      from public.faculties f
      join public.departments d on d.faculty_id = f.id
      join public.lecturer_assignments a on a.department_id = d.id
      where f.university_id = universities.id
        and a.lecturer_id = public.current_lecturer_id()
    )
  );

create policy "academic_sessions_assigned_read"
  on public.academic_sessions for select
  using (
    exists (
      select 1
      from public.semesters s
      join public.courses c on c.semester_id = s.id
      join public.lecturer_assignments a
        on a.department_id = c.department_id
        and (a.course_id is null or a.course_id = c.id)
      where s.academic_session_id = academic_sessions.id
        and a.lecturer_id = public.current_lecturer_id()
    )
  );

create policy "semesters_assigned_read"
  on public.semesters for select
  using (
    exists (
      select 1
      from public.courses c
      join public.lecturer_assignments a
        on a.department_id = c.department_id
        and (a.course_id is null or a.course_id = c.id)
      where c.semester_id = semesters.id
        and a.lecturer_id = public.current_lecturer_id()
    )
  );

create policy "lecture_rooms_assigned_read"
  on public.lecture_rooms for select
  using (
    lecture_rooms.department_id is null
    or exists (
      select 1 from public.lecturer_assignments a
      where a.lecturer_id = public.current_lecturer_id()
        and a.department_id = lecture_rooms.department_id
    )
  );

-- Attendance sessions: read own sessions; insert only a Draft for a
-- course the lecturer is assigned to, with lecturer_id = own profile.
create policy "attendance_sessions_own_read"
  on public.attendance_sessions for select
  using (lecturer_id = public.current_lecturer_id());

create policy "attendance_sessions_own_insert"
  on public.attendance_sessions for insert
  with check (
    lecturer_id = public.current_lecturer_id()
    and status = 'draft'
    and exists (
      select 1 from public.lecturer_assignments a
      join public.courses c on c.id = attendance_sessions.course_id
      where a.lecturer_id = public.current_lecturer_id()
        and a.department_id = c.department_id
        and (a.course_id is null or a.course_id = c.id)
    )
  );

-- Attendance records: readable only for own sessions. No direct
-- client insert/update — submissions go through an Edge Function
-- (Phase 2), so no insert/update policy is granted here.
create policy "attendance_records_own_session_read"
  on public.attendance_records for select
  using (
    exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_records.session_id
        and s.lecturer_id = public.current_lecturer_id()
    )
  );

-- Audit logs: read-only for the lecturer whose sessions they concern.
-- Inserts happen server-side (Edge Function / trigger); no client
-- insert policy is granted in Phase 1.
create policy "attendance_audit_logs_own_read"
  on public.attendance_audit_logs for select
  using (
    attendance_audit_logs.lecturer_id = public.current_lecturer_id()
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_audit_logs.session_id
        and s.lecturer_id = public.current_lecturer_id()
    )
  );
