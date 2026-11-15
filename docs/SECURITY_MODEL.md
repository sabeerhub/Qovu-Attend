# Security Model — UniAttend

## Principles (from the constitution)

- Server-side validation for all sensitive operations.
- **Never trust client-submitted attendance status.**
- Never expose service-role keys or secrets.
- Enforce authorization through backend policies.
- Use database constraints for data integrity.
- Write tests for security-critical behaviour.

## Authentication

- Supabase Auth for lecturer and administrator accounts.
- No student account is required for the MVP.
- The frontend uses only `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` (see `.env.example`). The anon key is a
  public client key; it grants nothing by itself — RLS decides access.
- A service-role key must never appear in the frontend, in the repo,
  or in any `.env` file committed to version control. It is only used
  by Edge Functions / server-side code, if at all.

## Authorization

- Department creation and assignment are controlled by the university
  administrator. Lecturers cannot create departments or grant
  themselves teaching assignments.
- A lecturer only sees courses and sessions belonging to their
  assignments in `lecturer_assignments`.
- Access is enforced in **two places**: Row Level Security in
  Postgres, and server-side checks in Edge Functions. Frontend
  filtering is presentation only and is never a security boundary.

## Row Level Security

RLS is enabled on all 12 tables in the initial migration. The policy
sketch in the migration:

- Authenticated users can read rows they are assigned to (via a join
  through `lecturer_assignments` / `lecturer_profiles.user_id =
  auth.uid()`).
- Lecturers can insert `attendance_sessions` only for courses they
  are assigned to, with `lecturer_id` equal to their own profile.
- `attendance_audit_logs` is insert-only for the application; there
  is no update or delete policy for ordinary users.

**Unverified:** these policies are written from the spec and have not
been run against a live Supabase project. Before pilot, they must be
applied to a staging project and tested with two lecturer accounts
(one assigned, one not) to confirm the unassigned lecturer sees
nothing. Do not treat them as verified until that test has run.

## Attendance integrity

- Unique constraint `attendance_records(session_id,
  registration_number)` prevents duplicate attendance within a
  session at the database level.
- `week_number` is constrained to 1–15 by a CHECK constraint, and
  validated again in the client (`lib/attendance.ts`) and server-side.
- Session lifecycle (draft → active → closed → finalized → archived)
  is an enum plus a tested transition table. Finalized records are
  read-only for ordinary use; corrections require an authorized
  action and an audit log row.
- QR tokens are secure random, short-lived, and expiry is validated
  server-side (Phase 2). The client never decides whether a session
  is still open.
- Rate limiting on attendance submissions and idempotency protection
  for retries are server-side concerns (Phase 2 Edge Function).
- Every manual entry and correction records lecturer, timestamp,
  reason and previous/new status in `attendance_audit_logs`.

## Exports

- PDF and CSV exports (Phase 3) must run with the same permission
  checks as the UI: a lecturer exports only their authorized records.
- CSV values must be escaped (see `lib/csv.ts` and its tests) to
  prevent formula injection (`=`, `+`, `-`, `@` at cell start).

## Secrets

- `.env` is gitignored. Only `.env.example` (placeholders) is
  committed.
- No secrets in code, logs, or seed data.
