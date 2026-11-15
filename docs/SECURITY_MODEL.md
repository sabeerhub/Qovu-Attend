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
- The frontend uses only the Supabase project URL and its publishable key. The publishable key is a
  public client key; it grants nothing by itself — RLS decides access.
- A service-role key must never appear in the frontend, in the repo,
  or in any file committed to version control. It is only used
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
  server-side (Phase 2, implemented). Only the SHA-256 hash of a
  token — and of the classroom passcode — is stored, in
  `attendance_sessions.qr_token_hash` / `passcode_hash` with
  `qr_token_issued_at` (migration `20261115010000`). The token and
  passcode are returned once, at activation, and cannot be recovered
  from the database afterwards. The client never decides whether a
  session is still open; the countdown in the UI is display-only.
- The client has NO insert/update policy on `attendance_records` or
  `attendance_audit_logs`, and `attendance_sessions` insert is
  Draft-only. All Phase 2 writes go through Edge Functions
  (`attendance-submit`, `session-transition`, `manual-attendance`),
  which use the service-role key server-side only. The frontend never
  sees that key, and the client never submits an attendance status.
- Rate limiting on attendance submissions (best-effort in-memory
  guard, 60/session/minute — not a production-grade distributed
  limiter) and idempotency protection for retries (stable
  per-(session, student) key, unique index on
  `(session_id, idempotency_key)`, duplicate retries return the
  original record) are server-side concerns (Phase 2 Edge Functions).
- Every manual entry and correction records lecturer, timestamp,
  reason and previous/new status in `attendance_audit_logs`.

## Exports

- PDF and CSV exports (Phase 3) must run with the same permission
  checks as the UI: a lecturer exports only their authorized records.
- CSV values must be escaped (see `lib/csv.ts` and its tests) to
  prevent formula injection (`=`, `+`, `-`, `@` at cell start).

## Secrets

- Environment files are gitignored and never committed.
  committed.
- No secrets in code, logs, or seed data.
