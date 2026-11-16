# Changelog — UniAttend

## v0.4.0 — 2026-11-16 — Lecturer-created courses + Apple-style mobile navigation

- **Lecturer-created courses (spec change, product-owner decision 2026-11-16).**
  Lecturers can now create a course from My Courses: department,
  semester, code, title, level, credit units. This overrides the
  Lecturer Dashboard spec v1.0 rule that courses are
  admin-controlled. Creating a course also creates the lecturer's
  own assignment to it, so the new course appears immediately.
- New migration `supabase/migrations/20261116000000_lecturer_course_create.sql`
  (existing migrations untouched): a `SECURITY DEFINER` RPC,
  `create_lecturer_course(...)`, that resolves the caller's profile
  from `auth.uid()`, validates everything server-side (department
  and semester exist; code/title/level/credit-unit rules; the
  unique `(department_id, code, semester_id)` rule with a clean
  duplicate error), and inserts the course and the assignment
  atomically. Executable by `authenticated` only. No direct client
  insert policy on `courses` or `lecturer_assignments`.
- The same migration loosens READ policies so any signed-in lecturer
  can read reference data for the form's pickers: `departments`,
  `semesters`, `academic_sessions`, `faculties`, `universities`.
  Attendance data keeps the assignment-based policies.
- Client: new pure `src/lib/courseForm.ts` (validation, RPC call,
  server-error mapping), new `CourseForm` component with
  loading/empty/error/success states (honest empty state when no
  departments or semesters exist yet — no invented options), new
  `useCourseReferenceData` hook, and a "New course" button on My
  Courses with list refresh on success. `useAssignments` takes an
  optional `refreshKey` (default 0; existing callers unchanged).
- **Mobile navigation (Apple-style).** The horizontal scrolling pill
  row is replaced by an iOS-style bottom tab bar (mobile only):
  Overview, Courses, Sessions, History, plus a "More" tab opening a
  bottom sheet with My Departments, Reports & Exports, Profile &
  Settings. Lucide icons + labels (never icons-only), accent-blue
  active state, white background, 1px top border, safe-area bottom
  padding; Escape/backdrop/Cancel close the sheet. Desktop sidebar
  unchanged. AppShell adds bottom padding so the bar never covers
  content. Navigation grouping is pure and tested
  (`src/lib/navigation.ts`).
- Tests: 25 new tests (course-form validation, error mapping,
  mocked-RPC create, navigation grouping); 124 tests total, all
  passing. `tsc -b` + vite build green. Note: the bundle passed
  500 kB minified (502.83 kB) with the first lucide-react imports,
  so vite now prints its chunk-size warning; the extra weight is
  the six tab/sheet icons plus the new code.
- **Not verified live:** the new migration has not been applied to
  the Supabase project (SQL Editor run needed), and the
  `create_lecturer_course` RPC has not been executed against a live
  database. The form's pickers only have options once departments
  and semesters exist (seed or admin setup).

## v0.3.1 — 2026-11-15 — Environment variables hidden from the repo

- Removed `.env.example` from the project entirely (no env file of any kind in the repo).
- Removed environment-variable names and `.env` instructions from all user-facing messages, README and docs. Connection values now live only in the deployment dashboard, never in this repo.
- The only remaining references are the unavoidable code reads: `src/lib/supabase.ts` and `src/types` (`vite-env.d.ts`) name the two connection keys so the app can read them at runtime (names only, never values), and the server-only Edge Function helper reads Supabase's own server-side names. No values exist anywhere in the repo.

## v0.3.0 — 2026-11-15 — Phase 2 attendance operations complete

- QR tokens + classroom passcodes: new pure `src/lib/qr.ts`
  (`generateQrToken` via `crypto.getRandomValues`, never
  `Math.random`; 6-digit passcodes; `isTokenExpired` /
  `tokenRemainingSeconds` display-only helpers; QR payload +
  submission URL builders), tested. `qrcode` (+ `@types/qrcode`)
  installed for rendering.
- New migration `supabase/migrations/20261115010000_session_qr_tokens.sql`
  (Phase 1 migration untouched): `qr_token_hash`,
  `qr_token_issued_at`, `passcode_hash` on `attendance_sessions`
  (SHA-256 hashes only), `idempotency_key` on `attendance_records`
  with a unique index on `(session_id, idempotency_key)`.
- Three Deno Edge Functions (`supabase/functions/`, each with a README
  noting they are untested against a live project):
  `attendance-submit` (public, no student account; active-session +
  hash + server-side expiry checks; normalisation; duplicate via the
  DB unique constraint; idempotency returns the original record on
  retry; status derived server-side; best-effort in-memory rate limit
  60/session/minute, documented as not production-grade),
  `session-transition` (lecturer auth + ownership; same transition
  table as the client; audit row per transition; fresh token +
  passcode on any transition to `active`, returned once),
  `manual-attendance` (manual add + correction, reason-required,
  audit-logged; refuses finalized/archived sessions).
- Activation + QR display: Draft sessions have an Activate action (in
  the list and in the monitor); on success the monitor shows the QR
  code, classroom passcode, display-only expiry countdown and
  submission link. Without a configured backend the honest
  unavailable state is shown — never a fake QR.
- Public student submission at `?submit=<sessionId>&token=<token>`
  (no sign-in): registration number only, passcode entry when no
  token is in the URL; success / already-submitted / expired / error
  states; no other session's data exposed; unavailable state when no
  backend is configured.
- Session monitoring (`src/features/attendance/SessionMonitor.tsx`):
  headcount, verified, manual, pending, rejected, suspicious and
  total counts from real record queries; headcount-vs-submissions
  difference labelled as a number to review, with the explicit text
  that a discrepancy is NOT automatic evidence of fraud; submitted
  registration numbers with statuses; loading / empty / error states.
- Manual attendance + corrections in the monitor (both reason-required,
  both via the Edge Function path, both audit-logged). Finalized /
  archived sessions are read-only: no manual/correction controls are
  rendered. Lifecycle controls (Start, Close, Finalize, Archive,
  Reopen) guarded by `canTransitionSession`.
- SessionForm: the Phase 1 passcode planning checkbox is removed;
  the form now states plainly that the QR code + passcode are
  generated at activation.
- Tests: 47 new tests (QR, submission helpers, Phase 2 lifecycle
  guards, mocked-client Edge Function integration tests); 99 tests
  total, all passing. `tsc -b` + vite build green.
- Docs: README status, `DATABASE_SCHEMA.md` (new columns),
  `API_CONTRACTS.md` (full Edge Function contracts + submit URL),
  `SECURITY_MODEL.md` (token hashing, server-side expiry, no client
  record/audit writes), `ATTENDANCE_RULES.md` (passcode now real),
  `TESTING_STRATEGY.md` (Phase 2 coverage + live pre-pilot checks),
  `supabase/functions/README.md`.
- Still not verified: no live Supabase project — migrations not
  applied, RLS untested live, Edge Functions not deployed or
  exercised against a real project. Phase 2 is local only, unpushed.

## v0.2.0 — 2026-11-15 — Phase 1 foundation complete

- Profile & Settings screen: loads the signed-in lecturer's
  `lecturer_profiles` row (full name, email, staff ID) via RLS, with
  loading / empty / error states and a plain note that assignments
  are admin-controlled.
- Assignment-driven departments and courses (`src/hooks/useAssignments.ts`):
  departments and courses are loaded only through
  `lecturer_assignments`; department/course counts are DISTINCT
  counts (null `course_id` ignored). New DepartmentWorkspace
  (faculty, assigned courses, academic session, department-filtered
  session/record stats and session history). CourseList shows
  department and semester names and filters by department.
- Overview: department filter that re-queries stats, recent
  attendance sessions and records, and courses with no sessions in
  their semester ("courses requiring attention", plainly labelled).
  Upcoming lectures still render the honest "timetable integration
  is not enabled" empty state.
- Academic calendar: new pure `src/lib/calendar.ts`
  (`weekForDate`, `validateLectureDate`, `weekDateRange`, tested) and
  an AcademicCalendarView under `src/features/calendar/` listing
  academic sessions and semesters with dates and the current
  teaching week.
- Full session creation form: department/course from authorized
  assignments, academic session/semester derived from the course,
  week 1–15 cross-checked against the lecture date via `calendar.ts`
  (mismatch rejected before any network call), lecture room from the
  department's `lecture_rooms`, headcount, QR expiry select
  (60/300/600/900 s). Lecturer, timestamp and `draft` status are
  system-set. Passcode is a documented Phase 2 setting and is not
  stored (no passcode column exists in the Phase 1 schema).
  SessionList now shows the course code via a course join.
- Tests: 37 new unit tests (calendar week derivation, distinct
  assignment counts, session-form validation); 52 tests total, all
  passing. `tsc -b` + vite build green.
- Docs: README status updated; `API_CONTRACTS.md` and
  `ATTENDANCE_RULES.md` updated only where behaviour changed
  (calendar week derivation, lecture-room + QR-expiry insert fields,
  passcode Phase 2 note).
- Still not verified: no live Supabase project — migration and RLS
  policies remain untested against a real project; no GitHub repo
  push in this change (local only).

## v0.1.0 — 2026-11-15 — Phase 1 foundation scaffold

- Created the full project tree (docs, src, supabase, tests).
- Wrote all 9 docs: product requirements, system architecture,
  database schema, security model, attendance rules, design system
  (Apple-minimalist, no AI slop), API contracts, testing strategy,
  deployment guide.
- Initial Supabase migration creating all 12 tables with constraints
  (week 1–15 CHECK, unique reg-no per session, session lifecycle
  enum, audit log) and RLS enabled with a policy sketch (unverified
  against live Supabase).
- Example-only seed data (Faculty of Computing; CIT 301, CIT 305,
  CSC 301), clearly marked as test data.
- Vite + React + strict TypeScript + Tailwind + shadcn-style UI
  skeleton; app shell with all 7 navigation sections; real Supabase
  Auth sign-in; overview statistics queried from the database;
  Draft session creation with week validation.
- Unit tests: week validation, session lifecycle transitions, CSV
  escaping / formula-injection neutralization.
- No GitHub repo created (local scaffold only); no live Supabase
  verification yet.
