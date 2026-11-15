# Database Schema — UniAttend

Source of truth for the schema is
`supabase/migrations/20261115000000_init.sql`. This document describes
it; the migration is authoritative. All 12 tables from spec §11.

## Tables

### universities
| Column | Type | Notes |
|---|---|---|
| id | uuid PK, default gen_random_uuid() | |
| name | text, not null | |
| short_name | text | |
| logo_url | text | |
| created_at | timestamptz, default now() | |

### faculties
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| university_id | uuid FK → universities, not null, cascade delete | |
| name | text, not null | |
| created_at | timestamptz, default now() | |

### departments
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| faculty_id | uuid FK → faculties, not null, cascade delete | |
| name | text, not null | |
| code | text | e.g. `IT`, `CSC`, `SEN` |
| created_at | timestamptz, default now() | |

### lecturer_profiles
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users, not null, unique | Supabase Auth id |
| full_name | text, not null | |
| email | text, not null | |
| staff_id | text | |
| created_at | timestamptz, default now() | |

### lecturer_assignments
Teaching permissions. A lecturer sees only what is assigned here.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| lecturer_id | uuid FK → lecturer_profiles, not null, cascade delete | |
| department_id | uuid FK → departments, not null, cascade delete | |
| course_id | uuid FK → courses, nullable | null = department-level assignment |
| role | text, default `lecturer`, check in (`lecturer`, `admin`) | |
| created_at | timestamptz, default now() | |
| unique (lecturer_id, department_id, course_id) | | No duplicate assignment |

### academic_sessions
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| university_id | uuid FK → universities, not null | |
| name | text, not null | e.g. `2025/2026` |
| start_date | date, not null | |
| end_date | date, not null | check end_date > start_date |
| created_at | timestamptz, default now() | |

### semesters
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| academic_session_id | uuid FK → academic_sessions, not null, cascade delete | |
| name | text, not null | e.g. `First Semester` |
| start_date | date, not null | |
| end_date | date, not null | check end_date > start_date |
| created_at | timestamptz, default now() | |

### courses
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| department_id | uuid FK → departments, not null, cascade delete | |
| semester_id | uuid FK → semesters, not null | |
| code | text, not null | e.g. `CIT 301` |
| title | text, not null | |
| level | integer, not null | e.g. 300 |
| credit_unit | integer | nullable where not applicable |
| created_at | timestamptz, default now() | |
| unique (department_id, code, semester_id) | | Same code, different semester is allowed |

### lecture_rooms
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| department_id | uuid FK → departments, nullable | |
| name | text, not null | e.g. `LT 1` |
| building | text | |
| capacity | integer | check capacity > 0 when set |
| latitude | double precision | Phase 4 GPS; nullable |
| longitude | double precision | Phase 4 GPS; nullable |
| created_at | timestamptz, default now() | |

### attendance_sessions
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| course_id | uuid FK → courses, not null, cascade delete | |
| lecturer_id | uuid FK → lecturer_profiles, not null | |
| semester_id | uuid FK → semesters, not null | |
| lecture_room_id | uuid FK → lecture_rooms, nullable | |
| title | text, not null | Lecture topic |
| lecture_date | date, not null | |
| week_number | integer, not null | **CHECK week_number BETWEEN 1 AND 15** |
| headcount | integer | expected/physically counted total; check >= 0 when set |
| qr_expires_in_seconds | integer, default 300 | |
| status | session_status enum, default `draft` | draft / active / closed / finalized / archived |
| created_at / updated_at | timestamptz, default now() | |

Session status transitions are enforced in application/Edge Function
logic and tested in `tests/unit/session-lifecycle.test.ts`. The enum
itself only restricts the value set.

### attendance_records
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK → attendance_sessions, not null, cascade delete | |
| registration_number | text, not null | Student reg. no. |
| student_name | text | only if available and authorized |
| status | text, default `verified` | check in (`verified`, `manual`, `pending`, `rejected`, `suspicious`) |
| verification_method | text | e.g. `qr`, `manual`, `passcode` |
| manual_reason | text | required in practice for manual entries (enforced server-side) |
| submitted_at | timestamptz, default now() | |
| **unique (session_id, registration_number)** | | **A reg. no. cannot be duplicated within a session** |

### attendance_audit_logs
Immutable audit events. No update/delete path is provided in the app.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK → attendance_sessions, nullable | |
| record_id | uuid FK → attendance_records, nullable | |
| lecturer_id | uuid FK → lecturer_profiles, nullable | |
| action | text, not null | e.g. `manual_attendance`, `correction`, `finalize` |
| previous_status | text | |
| new_status | text | |
| reason | text | |
| created_at | timestamptz, default now() | |

## Relationships

- One university → many faculties → many departments → many courses.
- A lecturer → many assignments → many departments/courses.
- One course → many attendance sessions.
- One session → one course, one academic week, many attendance records.
- One record → one session.

## Indexes

- `attendance_records(session_id)`, `attendance_sessions(course_id)`,
  `attendance_sessions(lecturer_id)`, `courses(department_id)`,
  `lecturer_assignments(lecturer_id)`, `attendance_audit_logs(session_id)`.

## Row Level Security

RLS is enabled on every table in the migration. Policies are sketched
in the migration file and described in `SECURITY_MODEL.md`. They have
**not** been verified against a live Supabase project — see the
unverified items in the migration and in the project README.
