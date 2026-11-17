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
  guard, 300/session/minute — raised from 60 in v0.5.0 so a full
  lecture hall scanning at once does not hit the limiter; still not a
  production-grade distributed limiter) and idempotency protection
  for retries (stable per-(session, student) key, unique index on
  `(session_id, idempotency_key)`, duplicate retries return the
  original record) are server-side concerns (Phase 2 Edge Functions).
- Every manual entry and correction records lecturer, timestamp,
  reason and previous/new status in `attendance_audit_logs`.

## Smart verification (Phase 4, v0.5.0)

- **Lecturer-anchored location.** Activation captures the lecturer's
  device location and stores it on the session as the anchor; the
  radius is 30 m. Every student submission must carry device
  coordinates, and the `attendance-submit` function checks the
  Haversine distance server-side. A submission without coordinates
  is refused; client-side distance math is display-only and is never
  trusted. Sessions activated before v0.5.0 have no anchor and refuse
  submissions until closed and reopened.
- **Device binding.** Each submission carries the SHA-256 hash of a
  device fingerprint (screen, user agent, timezone, hardware,
  canvas). Only the hash is sent or stored — raw device attributes
  never leave the phone. The first submission binds a device to one
  registration number (`device_registrations`, unique on the hash);
  one device may submit once per session (partial unique index on
  `(session_id, device_fingerprint_hash)`).
- **Honest limits — read these before trusting the checks.** These
  are mitigations, not guarantees:
  - GPS can be spoofed with mock-location apps; a student who fakes
    their coordinates can pass the distance check. Location verifies
    the reported position, not the person.
  - Indoor GPS drifts 10–20 m. A 30 m radius with a drifting fix can
    falsely reject an honest student at the back of the hall; that is
    why a reported accuracy worse than 100 m is refused outright
    rather than trusted.
  - A fingerprint is a hashed deterrent, not a proof of identity. A
    second phone, a wiped browser, or a spoofed fingerprint defeats
    device binding. It catches the common case (one phone submitting
    for several students); it does not make proxy attendance
    impossible.
  - The physical headcount is the check no phone can fake — it is
    the cross-check against the other two, and its mismatch flag is
    review-only, never automatic fraud.
- No facial liveness in this slice (spec: only after a
  privacy/feasibility review). No student accounts were added.

## Face check — live selfie (Phase 4, v0.10.0)

- **Live selfie (v0.10.0).** After location and device are
  verified, the student must take a live selfie with the front
  camera (one still photo, small JPEG, max ~480 px wide) before
  the final submit. The server also receives the photo's 8x8
  average hash (16 hex chars, computed on the phone). A submission
  without a selfie is refused server-side (`selfie_required`) —
  there is no self-submission without one. If the same hash is
  submitted for two different registration numbers in the SAME
  session, both records are flagged for lecturer review — never
  auto-rejected, never a refusal. The lecturer sees the photo
  (short-lived signed URL, only for the assigned lecturer) and
  confirms (record becomes `suspicious`) or dismisses (flag
  cleared) with a reason; both decisions are audit-logged.
- **A live selfie is required for self-submission.** A missing /
  denied camera stops the form with a plain message — it never
  submits without a photo. A student without a front camera goes
  to the lecturer, who adds them by hand (manual attendance) —
  the only fallback, and it needs no selfie.
- **Photos are deleted after the session.** Photos live in the
  private `session-selfies` Storage bucket and are deleted when
  the session is Finalized (`selfie_path` cleared on the records;
  the hash and the review flag stay). Only the Edge Functions
  (service role) write or delete photos; lecturers read only their
  own sessions' photos, enforced by a Storage policy. There is no
  public access and no direct upload from the client.
- **Honest limits — read these before trusting the check.** This is
  NOT face recognition and NOT identity proof:
  - There are no student photos on file, so the check can never
    prove the face belongs to the registration number. It only
    catches the same face used for two numbers in one class.
  - A similar-looking photo (twins, family, a hash collision, a
    bad photo) can flag an honest student — which is why a flag is
    review-only, never a refusal.
  - An average hash is a rough similarity code, not a face
    match: the same face in different light, or a different face
    with a similar layout, can hash the same or differently. It
    catches the common case (one student submitting for two
    numbers with the same phone and face); it does not make proxy
    attendance impossible.
  - A uniform frame (covered camera, blank wall) carries no face
    information and runs no duplicate check.
  - The physical headcount remains the check no phone can fake.

## Exports

- PDF and CSV exports (Phase 3) must run with the same permission
  checks as the UI: a lecturer exports only their authorized records.
- CSV values must be escaped (see `lib/csv.ts` and its tests) to
  prevent formula injection (`=`, `+`, `-`, `@` at cell start).

## Secrets

- Environment files are gitignored and never committed.
  committed.
- No secrets in code, logs, or seed data.
