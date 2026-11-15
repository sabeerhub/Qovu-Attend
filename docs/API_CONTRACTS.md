# API Contracts — UniAttend

This is the Phase 1 contract surface. There is no custom REST API in
Phase 1: the frontend talks to Supabase (PostgREST + Auth) and, from
Phase 2, to Supabase Edge Functions. This document states the
contracts so the client and server can never drift apart silently.

## Conventions

- All dates are ISO 8601 (`YYYY-MM-DD` for lecture dates,
  full timestamps for `submitted_at` / `created_at`).
- Week numbers are integers 1–15, validated client- and server-side.
- IDs are UUIDs.
- The authenticated lecturer's id is always taken from the auth
  session (`auth.uid()` / `lecturer_profiles.user_id`), never from a
  request body.

## Supabase tables used by the client (Phase 1)

The client may read, through RLS:

- `lecturer_profiles` — own profile only.
- `lecturer_assignments` — own assignments only.
- `departments`, `courses`, `academic_sessions`, `semesters`,
  `lecture_rooms` — only rows reachable through own assignments
  (or, for sessions/semesters, the rows referenced by assigned
  courses).
- `attendance_sessions` — own sessions only.
- `attendance_records` — records of own sessions only.

The client may insert:

- `attendance_sessions` — Draft creation only in Phase 1, with
  `lecturer_id` = own profile id and `status = 'draft'`. All other
  fields as listed in `ATTENDANCE_RULES.md`.

The client must never insert/update/delete:

- `attendance_records` directly with a client-chosen status (Phase 2
  submissions go through an Edge Function).
- `attendance_audit_logs` (insert-only, server-side).
- `universities`, `faculties`, `departments` (admin-controlled).

## Edge Functions (Phase 2+, planned — not implemented)

| Function | Purpose |
|---|---|
| `attendance-submit` | Accept a registration number + QR token, validate session state and expiry server-side, enforce uniqueness + rate limit, derive status, return the record. |
| `session-transition` | Move a session between lifecycle states with authorization + audit logging. |
| `export-report` | Generate PDF / CSV scoped to the lecturer's authorized records. |

No Edge Function exists yet in `supabase/functions/` — the folder
holds a README stating the plan. Do not call an endpoint that does
not exist.

## Errors

- Unconfigured Supabase (`VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` missing): the app shows a configuration
  empty state, not a crash and not fake data.
- Unauthorized (no assignment): the query returns no rows; the UI
  shows the empty state. The client must not invent a fallback.
- Validation failure (e.g. week outside 1–15): rejected before any
  network call, with a field-level message.

## CSV contract (Phase 3)

Columns, in order: registration number, student name (if available
and authorized), department, course code, academic session, semester,
week, attendance title, lecture date, attendance status,
verification method, submission timestamp, manual attendance reason
(if applicable). Values are escaped per RFC 4180 and formula
injection is neutralized (see `lib/csv.ts`).
