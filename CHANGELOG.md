# Changelog — UniAttend

## v0.5.2 — 2026-11-16 — QR codes now open the attendance page when scanned

- **QR code content fixed (v0.5.2, product-owner report: scanning the QR showed
  raw text instead of opening attendance).** The QR used to encode a JSON
  payload (`{"v":1,"sessionId":...,"token":...}`), and a phone camera only
  opens a QR code when it contains a URL — so phones displayed the raw data
  text instead of the attendance page. The QR now encodes the public
  submission URL itself (`https://uniattend-x.vercel.app/?submit=<sessionId>&token=<token>`).
  The URL is at the app root on purpose: this repo has no SPA rewrite, so a
  `/submit` path would 404 on the host, while `/` always serves the app and
  AppShell already reads the query string there. The QR image and the
  displayed "Submission link" text are now built from the same single URL, so
  the two can never disagree again. The old JSON payload parser
  (`parseQrPayload`) is removed as dead code — nothing used it except its own
  tests. Token, passcode, expiry, location and device rules are untouched.
- Client: `src/lib/qr.ts` (`buildQrPayload` now takes the origin and returns
  the submission URL; `buildSubmitUrl` builds the root-path URL),
  `src/features/attendance/QrDisplay.tsx` (one URL built once, used for the
  QR and the link text); tests: `tests/unit/qr.test.ts` (QR content is a URL
  on the given origin, token round-trips, URL-unsafe token characters
  survive); docs: `docs/API_CONTRACTS.md` (QR payload is a submission URL,
  not JSON).

## v0.5.1 — 2026-11-16 — Location capture that works indoors: longer fix + explicit permission step

- **Location capture fixed (v0.5.1, product-owner report: activation failed with the
  location-required error even with location services on).** The old capture was one
  high-accuracy attempt with a 10 s timeout — a GPS fix indoors routinely takes longer
  than 10 s or fails, so activation was refused even when location was on. Capture is
  now two-stage: high accuracy for 30 s, then, only on a timeout or an unavailable
  position, a network-based fix for 15 s (cached fixes up to 30 s old accepted). A
  denied permission still fails fast with no retry. The 30 m radius and the 100 m
  accuracy cap are unchanged, and the mandatory-location rules are unchanged: no
  location, no activation and no submission.
- **Explicit permission step.** Before capturing, the app checks the permission state
  with `navigator.permissions` where the browser has it. If location is denied for
  this site, the app does not call `getCurrentPosition` again — a denied permission
  never re-prompts — and instead shows a blocked panel with plain re-allow steps for
  Chrome (address-bar tune/lock icon → Site settings → Location → Allow) and Safari
  (aA icon → Website Settings → Location → Allow), plus a "Try again" button that
  re-checks the permission. If the state is 'prompt' or 'granted', an "Allow location
  to continue" button triggers the capture from an explicit tap so the browser shows
  its prompt reliably. Without a Permissions API the app goes straight to the capture.
  A website cannot force the browser to re-show the prompt after a denial and cannot
  switch on OS location services — the in-app panel + instructions is the correct
  mechanism.
- **Visible locating state.** Activation (monitor and session list) and student
  submission now show "Finding your location…" while the capture runs, instead of
  silence followed by an error.
- Client: `src/lib/geo.ts` (two-stage `requestDeviceLocation`, `queryLocationPermission`,
  `nextLocationStep`); new `src/components/ui/location-permission.tsx`
  (`LocationBlockedPanel`, `LocationAllowPanel`); `SessionMonitor` / `SessionList` /
  `SubmitAttendance` route location through the permission gate. No Edge Function
  changes, no migration, no schema change.
- Tests: `tests/unit/geo.test.ts` — stage-1 success, timeout/unavailable falling back
  to the network fix, denial failing fast with no retry, both stages failing, and
  permission-state branching (denied → blocked, prompt/granted → ask, no Permissions
  API → straight to capture).

## v0.5.0 — 2026-11-16 — Smart verification: lecturer-anchored location, device binding, headcount confirm

- **Lecturer-anchored location (Phase 4 slice 1, product-owner decisions 2026-11-16).**
  When a session is activated, the lecturer's device location is captured in the browser and
  stored on the session as the anchor. Every student submission must carry the student's
  device coordinates — a submission without a location is refused, with no fallback — and
  the `attendance-submit` Edge Function checks server-side (Haversine) that the student is
  within the session's radius of the anchor. **Radius is 30 metres** (owner's rule: if the
  student and the lecturer are in the same location and the distance is not above 30 m the
  student is eligible; above 30 m the submission is rejected). A reported accuracy worse
  than 100 m is refused as too imprecise. The check applies identically to the QR-token
  path and the passcode path; client-side distance math is display-only. Sessions activated
  before v0.5.0 have no anchor and refuse submissions until closed and reopened. An
  activation without a usable lecturer location is refused (`anchor_required`) — no silent
  fallback. The monitor shows the anchor state after activation (captured time, accuracy,
  radius).
- **Device binding (Phase 4 slice 1).** The submission page computes a device fingerprint
  (screen, user agent, timezone, hardware, canvas — hashed with SHA-256; only the hash
  ever leaves the phone) and sends it with every submission. Server-side, the first
  submission binds a device to one registration number (`device_registrations`, unique on
  the hash); a later submission from the same device for a different number is refused
  (`device_bound_to_another_student`), and one device may submit once per session (partial
  unique index on `(session_id, device_fingerprint_hash)`). A per-browser localStorage flag
  is a UX hint only — the server enforces. Manual attendance stays lecturer-attested, with
  no location/device checks, audit-logged as before.
- **Headcount confirmed at activation.** The headcount was only an expected number entered
  at session creation; the lecturer counts real bodies in the hall just before projecting
  the QR. The monitor now shows a "Physical headcount — confirm now" field when starting
  (or reopening) a session, prefilled with the stored count, saved to the session with the
  activation call. When verified + manual submissions exceed the confirmed headcount the
  monitor shows a review flag ("Submissions exceed the physical headcount — review") —
  display only, never automatic fraud, per the spec rule.
- **Projector QR.** `QrDisplay` gains a fullscreen projector view (large high-contrast QR
  + big passcode, minimal chrome, Esc to close) so the code reads from the back of the hall.
  The QR is now rendered at 560 px for a crisp projection.
- **Submission rate limit raised (Phase 4 addition).** `attendance-submit` went from 60 to
  **300 submissions per session per minute**: a full Nigerian lecture hall scanning at once
  must not hit the limiter. Still the same in-memory best-effort guard, not a distributed
  limiter.
- **Honest limits, stated in `docs/SECURITY_MODEL.md`:** GPS can be spoofed with
  mock-location apps, indoor GPS drifts 10–20 m, and a fingerprint is a hashed deterrent,
  not a proof of identity. Location + device checks verify the phone, not the person;
  they are mitigations, not guarantees. No facial liveness in this slice (spec: only after
  a privacy/feasibility review). No student registration or accounts were added.
- New migration `supabase/migrations/20261116020000_smart_verification.sql` (existing
  migrations untouched): anchor columns + `location_radius_meters` (default 30) on
  `attendance_sessions`; `device_fingerprint_hash` on `attendance_records` + partial unique
  index; new `device_registrations` table (RLS on, no policies — service role only).
- Client: new pure `src/lib/geo.ts` (Haversine, radius/accuracy rules, Geolocation wrapper)
  and `src/lib/deviceFingerprint.ts` (stable fingerprint + SHA-256, injectable for tests,
  localStorage flag helpers); `src/lib/edgeFunctions.ts` payloads carry the anchor,
  headcount, coordinates and fingerprint; `SessionMonitor` / `SessionList` capture the
  lecturer location before activation; `SubmitAttendance` blocks without location or
  fingerprint and maps the new server error codes to plain language.
- Tests: `tests/unit/geo.test.ts` (Haversine known distances, radius/accuracy rules),
  `tests/unit/deviceFingerprint.test.ts` (hash stability, known SHA-256 vector,
  no-window-at-import), `tests/unit/submission.test.ts` (headcount-confirm parsing),
  `tests/integration/edge-functions.test.ts` (anchor + headcount sent on activation,
  location + fingerprint sent on submission).

## v0.4.1 — 2026-11-16 — Lecturer sets lecture date, start time and week freely

- **Session creation unblocked (spec change, product-owner decision 2026-11-16).**
  The lecturer now assigns the lecture date AND start time himself,
  and the semester date range no longer blocks or rejects a session.
  This overrides spec §6 (week validated against the academic
  calendar): a lecture date outside the semester dates is allowed,
  and the chosen week (1–15) need not match the week the date falls
  in. The live semester dates were stale example data (First
  Semester 2025-09-01 → 2026-01-31), so every date was being
  rejected; the fix is the rule change, not new semester dates.
- New migration `supabase/migrations/20261116010000_session_start_time.sql`
  (existing migrations untouched): `attendance_sessions.start_time`
  (`time`, nullable so existing sessions are unaffected).
- Client: the session form gains a required "Lecture start time"
  (`type="time"`, 24-hour HH:MM, validated in `src/lib/sessionForm.ts`)
  next to the lecture date, and sends `start_time` in the insert
  payload. When the picked date falls inside the semester, the
  derived week is suggested in the week select (still
  lecturer-editable); when it falls outside, there is no suggestion
  and the chosen week stands. The semester date-range line under the
  selected course is removed (only academic session + semester name
  remain). `validateLectureDate` stays in `src/lib/calendar.ts` as a
  tested pure utility for the academic calendar; it no longer gates
  session creation.
- `src/types/database.ts`: `AttendanceSession` gains
  `start_time: string | null`.
- Tests: `tests/unit/session-form-validation.test.ts` rewritten for
  the new behaviour (out-of-semester date valid, week/date mismatch
  valid, missing/invalid start time rejected) plus tests for
  `isValidStartTime` and `suggestedWeekForLectureDate`.

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
