# Database Schema — UniAttend

Source of truth for the schema is the migrations in
`supabase/migrations/`. This document describes them; the migrations
are authoritative. All 12 tables from spec §11, plus the Phase 2
columns added by `20261115010000_session_qr_tokens.sql`, the
lecturer-course RPC added by `20261116000000`, the `start_time`
column added by `20261116010000`, and the Phase 4 smart-verification
columns + `device_registrations` table added by
`20261116020000_smart_verification.sql`.

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

### create_lecturer_course (RPC, v0.4.0)

`create_lecturer_course(p_department_id, p_semester_id, p_code,
p_title, p_level, p_credit_unit) returns courses` — `SECURITY
DEFINER`, executable by `authenticated` only. Resolves the caller's
lecturer profile from `auth.uid()` (error if none); validates
department and semester exist, code (trimmed, upper-cased, ≤ 20
chars, letters/numbers/spaces only), title (≤ 120 chars), level
(100–900), credit units (null or 1–6); inserts the course and the
caller's own `lecturer_assignments` row (role `lecturer`)
atomically; returns the created course. Duplicate code in the same
department + semester raises a clean `course_code_duplicate` error
via the unique constraint. See `docs/API_CONTRACTS.md`.

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

### lecture_plans (v0.8.0 — My Lecture Plan)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| lecturer_id | uuid FK → lecturer_profiles, not null, cascade delete | the plan's owner |
| course_id | uuid FK → courses, not null, cascade delete | deleting a course deletes its plan entries |
| day_of_week | smallint, not null | 1 = Monday .. 6 = Saturday; check 1–6 |
| start_time | time, not null | |
| end_time | time, nullable | check end_time > start_time when set |
| room | text, nullable | free-text venue, ≤ 80 chars |
| created_at | timestamptz, default now() | |
| updated_at | timestamptz, default now() | |

Unique `(lecturer_id, course_id, day_of_week, start_time)` — the same lecture cannot be planned twice. Indexes on `lecturer_id` and `course_id`.

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
| start_time | time, nullable | Lecture start time (HH:MM), set by the lecturer. Null on sessions created before v0.4.1. Added by `20261116010000_session_start_time.sql` |
| week_number | integer, not null | **CHECK week_number BETWEEN 1 AND 15** |
| headcount | integer | expected/physically counted total; check >= 0 when set |
| qr_expires_in_seconds | integer, default 300 | |
| status | session_status enum, default `draft` | draft / active / closed / finalized / archived |
| qr_token_hash | text, nullable | **Phase 2:** SHA-256 hash of the live QR token. Never the token itself. Added by `20261115010000_session_qr_tokens.sql` |
| qr_token_issued_at | timestamptz, nullable | **Phase 2:** when the live token was issued; expiry = this + `qr_expires_in_seconds`, checked server-side |
| passcode_hash | text, nullable | **Phase 2:** SHA-256 hash of the 6-digit classroom passcode. Never the passcode itself |
| anchor_latitude | double precision, nullable | **Phase 4 (v0.5.0):** lecturer's device latitude at activation. Added by `20261116020000_smart_verification.sql` |
| anchor_longitude | double precision, nullable | **Phase 4 (v0.5.0):** lecturer's device longitude at activation |
| anchor_accuracy_meters | double precision, nullable | **Phase 4 (v0.5.0):** reported GPS accuracy in metres at capture |
| anchor_captured_at | timestamptz, nullable | **Phase 4 (v0.5.0):** when the anchor was captured |
| location_radius_meters | integer, not null, default 30 | **Phase 4 (v0.5.0):** allowed distance in metres from the anchor; check > 0 |
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
| idempotency_key | text, nullable | **Phase 2:** stable per-(session, student) key; unique index on `(session_id, idempotency_key)` where not null, so a retried submission returns the original record |
| device_fingerprint_hash | text, nullable | **Phase 4 (v0.5.0):** SHA-256 hash of the submitting device's fingerprint. Hash only; raw attributes never leave the phone. Null on manual records. Added by `20261116020000_smart_verification.sql` |
| submitted_at | timestamptz, default now() | |
| **unique (session_id, registration_number)** | | **A reg. no. cannot be duplicated within a session** |
| **unique index (session_id, device_fingerprint_hash) where not null** | | **Phase 4 (v0.5.0): one device, one submission per session** |

### device_registrations (Phase 4, v0.5.0)
First submission binds a device to one registration number, across all sessions.
| Column | Type | Notes |
|---|---|---|
| device_fingerprint_hash | text PK | SHA-256 hash only; never raw device attributes |
| registration_number | text, not null | The one student this device is bound to |
| first_seen_at | timestamptz, default now() | |
| index on registration_number | | Lookup by student |

RLS is on with no policies: only the Edge Functions (service role) read and write
this table. The frontend never touches it. Added by
`20261116020000_smart_verification.sql`.

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

v0.4.0 addition (`20261116000000_lecturer_course_create.sql`): any
signed-in lecturer may read the reference tables `departments`,
`semesters`, `academic_sessions`, `faculties` and `universities`
(policies `*_authenticated_read`), so the course-creation pickers
have options. Course creation itself is server-side only, through
the `create_lecturer_course` RPC — there is no direct client insert
policy on `courses` or `lecturer_assignments`.

v0.5.0 addition (`20261116020000_smart_verification.sql`): the
`device_registrations` table has RLS on with no policies (service
role only, via the Edge Functions). The anchor columns on
`attendance_sessions` and `device_fingerprint_hash` on
`attendance_records` are written only by the Edge Functions, never
by the client directly.

v0.8.0 addition (`20261117030000_lecture_plans.sql`): the
`lecture_plans` table (see below). A lecturer reads, updates and
deletes only their own rows (`lecturer_id =
current_lecturer_id()`); there is no direct client insert policy —
inserts go through the `create_lecture_plan` RPC, which refuses any
course the caller is not assigned to. The update policy's WITH
CHECK also re-verifies course ownership on the new row.
