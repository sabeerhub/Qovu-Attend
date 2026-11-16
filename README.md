# Qovu — Lecturer Portal

University Attendance Management System. Lecturer Portal, Phase 1
foundation scaffold.

A lecturer teaches multiple courses across multiple departments.
Every attendance record belongs to a specific lecturer, department,
course, academic session, semester, week and lecture session.
A semester has 15 teaching weeks.

## Stack

React + Vite, TypeScript (strict), Tailwind CSS + shadcn/ui,
Supabase (PostgreSQL, Auth, Edge Functions), Cloudflare Pages.
Free tier only.

## Status — Phase 2 attendance operations complete (v0.3.0, 2026-11-15)

Done (Phase 2):

- QR tokens + classroom passcodes: pure `src/lib/qr.ts` (secure random
  tokens via `crypto.getRandomValues`, never `Math.random`; 6-digit
  passcodes; server-side expiry helpers that are display-only in the
  UI; QR payload + public submission URL), tested (16 tests). The
  `qrcode` package renders the code.
- New migration `supabase/migrations/20261115010000_session_qr_tokens.sql`:
  `qr_token_hash`, `qr_token_issued_at` and `passcode_hash` on
  `attendance_sessions` (SHA-256 hashes only — never the token or
  passcode), plus `idempotency_key` on `attendance_records` with a
  unique index on `(session_id, idempotency_key)`.
- Three Deno Edge Functions in `supabase/functions/` (each with a
  README noting they are untested against a live project):
  `attendance-submit` (public, no student account; session must be
  `active`; token/passcode verified by hash + server-side expiry;
  registration number normalised; duplicate via the DB unique
  constraint; stable idempotency key returns the original record on
  retry; status derived server-side as `verified`; best-effort
  in-memory rate limit of 60/session/minute, documented as not
  production-grade), `session-transition` (lecturer auth + ownership
  check; same transition table as the client; audit row per
  transition; fresh token + passcode generated on any transition to
  `active`, returned once), `manual-attendance` (manual add and
  correction, both reason-required and audit-logged; refuses
  finalized/archived sessions).
- Session activation + QR display: Draft sessions have an Activate
  action (list and monitor); on success the monitor shows the QR code,
  the classroom passcode, a display-only expiry countdown and the
  submission link. Without a configured backend the honest
  unavailable state is shown — never a fake QR.
- Public student submission at `?submit=<sessionId>&token=<token>`
  (no sign-in, no student account): asks only for a registration
  number, or the passcode when no token is in the URL; shows success /
  already-submitted / expired / error states; exposes no other
  session's data. Unavailable state when no backend is configured.
- Session monitoring (`SessionMonitor`): headcount, verified, manual,
  pending, rejected, suspicious and total counts from real record
  queries, plus the headcount-vs-submissions difference labelled as a
  number to review with the explicit text that a discrepancy is NOT
  automatic evidence of fraud; submitted registration numbers with
  statuses; loading / empty / error states.
- Manual attendance + corrections in the monitor (registration number
  + reason, new status + reason — both required, both through the
  Edge Function path, both audit-logged). Finalized/archived sessions
  are read-only in the UI: no manual/correction controls are rendered.
- Lifecycle controls in the monitor (Start, Close, Finalize, Archive,
  Reopen), every button guarded by `canTransitionSession`; illegal
  transitions are never offered.
- Tests: 47 new tests (QR, submission helpers, Phase 2 lifecycle
  guards, mocked-client Edge Function integration tests); 99 tests
  total, all passing. `tsc -b` + vite build green.

Not done / not verified:

- **No live Supabase project yet.** The migrations have not been
  applied anywhere, the RLS policies have not been tested live, and
  the three Edge Functions have not been deployed or exercised
  against a real project. Deploy to staging first (see
  `supabase/functions/README.md`) and run the pre-pilot checks in
  `docs/TESTING_STRATEGY.md`. The app shows a "not configured" empty
  state until the Supabase connection is set up (values live in your deployment dashboard, never in this repo).
- Phase 3 (history filters, PDF/CSV exports) and Phase 4 (GPS,
  risk, facial liveness) are not built.

## Status — Phase 1 foundation complete (v0.2.0, 2026-11-15)

Done:

- Full directory tree, docs (9 docs + the Lecturer Dashboard spec),
  12-table migration with constraints + RLS sketch, example-only seed.
- App shell with all 8 navigation sections, Apple-minimalist design
  system (see `docs/DESIGN_SYSTEM.md`).
- Real Supabase Auth sign-in and a Profile & Settings screen that
  loads the signed-in lecturer's row from `lecturer_profiles`
  (full name, email, staff ID). Assignments are admin-controlled,
  except that since v0.4.0 a lecturer can create a course
  themselves — the course is then assigned to them automatically
  (see `CHANGELOG.md`).
- Assignment-driven departments and courses: everything shown comes
  through `lecturer_assignments` (distinct department/course counts,
  never raw rows). Each department opens its own workspace (faculty,
  assigned courses, academic session, department-filtered stats and
  session history). Courses show department and semester names and
  filter by department.
- Overview with real database statistics, a department filter that
  re-queries, recent sessions and records, and courses with no
  sessions this semester. Upcoming lectures are omitted as data
  (timetable integration is not enabled) and the section says so.
- Academic calendar view (academic sessions and semesters with dates
  and the current teaching week) backed by pure, tested calendar
  helpers: week 1 is the first 7 days from the semester start date,
  week numbers run 1–15, dates outside the semester or beyond week 15
  have no week.
- Full session creation form: department and course from authorized
  assignments only, academic session/semester derived from the
  course, week 1–15 cross-checked against the lecture date via the
  calendar (a mismatch is rejected before any network call), lecture
  room from the department's rooms, headcount, QR expiry (60 / 300 /
  600 / 900 seconds). Lecturer, timestamp and status `draft` are set
  by the system. Multiple sessions per course per week are allowed.
  Classroom passcode was, at that point, a documented Phase 2 setting:
  no passcode column existed in the Phase 1 schema, so the choice was
  shown for planning and was not stored. (Phase 2, above, replaced
  this with server-generated passcodes issued at activation.)
- Unit tests for week validation, session lifecycle, CSV escaping,
  calendar week derivation, distinct assignment counts, and
  session-form validation (52 tests, all passing).

Not done / not verified (at v0.2.0):

- **No live Supabase project yet.** The migration has not been
  applied anywhere and the RLS policies have not been tested live.
  The app shows a "not configured" empty state until
  the Supabase connection is set up (values live in your deployment dashboard, never in this repo).
- **No GitHub repo yet.** This scaffold is local only. The repo is
  to be created by Mustapha (public, name `UniAttend`, under
  `sabeerhub`) — the GitHub App token could not create it (403).
  (The repo was created later, 2026-11-15; Phase 2 work here is
  local only and unpushed.)
- Phase 2 (QR, monitoring, manual attendance), Phase 3 (history,
  PDF/CSV exports) and Phase 4 (GPS/passcode, risk) are not built.
  (Phase 2 is now built — see the status above; Phases 3–4 are not.)

## Quick start

```bash
npm install
# Set the Supabase connection values in your deployment dashboard — never in this repo.
npm run dev            # dev server
npm test               # unit tests (no credentials needed)
npm run build          # tsc (strict) + vite build
```

## Docs

- `docs/LECTURER_DASHBOARD_SPEC.md` — the full product spec v1.0
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/SECURITY_MODEL.md`
- `docs/ATTENDANCE_RULES.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/API_CONTRACTS.md`
- `docs/TESTING_STRATEGY.md`
- `docs/DEPLOYMENT_GUIDE.md`

## Working rules

See `AGENTS.md` (the Engineering Constitution). In short: inspect,
plan, explain before changing, build only approved scope, run tests
and report actual results, never claim a test passed unless it ran,
never proceed to another phase without approval.
