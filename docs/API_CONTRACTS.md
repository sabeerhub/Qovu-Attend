# API Contracts — UniAttend

This is the Phase 2 + Phase 4 (v0.5.0) contract surface. There is no custom REST API:
the frontend talks to Supabase (PostgREST + Auth) and to Supabase
Edge Functions (Phase 2, smart verification in Phase 4). This document states the contracts so the
client and server can never drift apart silently.

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
  courses). Lecture rooms are read only for the lecturer's assigned
  departments, to offer a room choice in session creation.
- Since v0.4.0, any signed-in lecturer may also read the reference
  tables `departments`, `semesters`, `academic_sessions`,
  `faculties` and `universities` in full (policies
  `*_authenticated_read`), so the course-creation pickers have
  options. Attendance data is unaffected by this.
- `attendance_sessions` — own sessions only.
- `attendance_records` — records of own sessions only.

The client may insert:

- `attendance_sessions` — Draft creation only in Phase 1, with
  `lecturer_id` = own profile id and `status = 'draft'`. All other
  fields as listed in `ATTENDANCE_RULES.md`: `course_id`,
  `semester_id` (derived from the course), `lecture_room_id`
  (nullable, from the department's rooms), `title`, `lecture_date`,
  `start_time` (24-hour HH:MM, set by the lecturer),
  `week_number`, `headcount` (nullable, >= 0), `qr_expires_in_seconds`
  (60, 300, 600 or 900). The client validates the week (1–15) and
  the start time before inserting; the lecture date and week are set
  freely by the lecturer and are not cross-checked against the
  semester dates (v0.4.1, product-owner decision). The database
  CHECK (week 1–15, headcount >= 0) is the server-side backstop.

The client must never insert/update/delete:

- `courses` or `lecturer_assignments` directly. Course creation
  goes only through the `create_lecturer_course` RPC below.
- `attendance_records` directly with a client-chosen status (Phase 2
  submissions go through an Edge Function).
- `attendance_audit_logs` (insert-only, server-side).
- `universities`, `faculties`, `departments` (admin-controlled).

## RPC: create_lecturer_course (v0.4.0, implemented — untested against a live project)

Defined in
`supabase/migrations/20261116000000_lecturer_course_create.sql`.
The client calls it via `supabase.rpc('create_lecturer_course', …)`
(see `src/lib/courseForm.ts` `createCourse`); the lecturer's id is
taken from the auth session, never from the request.

Request (arguments):

```json
{
  "p_department_id": "uuid",
  "p_semester_id": "uuid",
  "p_code": "CIT 301",
  "p_title": "Web Technology",
  "p_level": 300,
  "p_credit_unit": 3
}
```

`p_credit_unit` may be `null`. The server trims and upper-cases the
code; it validates department and semester exist, level 100–900,
credit units 1–6 when set, and the unique
`(department_id, code, semester_id)` rule. On success it returns the
created `courses` row and has also inserted the caller's own
`lecturer_assignments` row (role `lecturer`) in the same
transaction. On failure PostgREST returns the RPC exception message,
prefixed with a stable code the client maps to plain language
(`course_code_duplicate`, `lecturer_profile_not_found`,
`department_not_found`, `semester_not_found`, plus the field-level
codes `course_code_required`, `course_code_too_long`,
`course_code_invalid`, `course_title_required`,
`course_title_too_long`, `course_level_invalid`,
`course_credit_unit_invalid`).

## Edge Functions (Phase 2, implemented — untested against a live project)

Implemented in `supabase/functions/` (see `supabase/functions/README.md`).
Each function is a Deno Edge Function using the service-role key
server-side; the frontend never sees that key. The client calls them
via `src/lib/edgeFunctions.ts`, which preserves the server's error
body (`{ ok, error: { code, message } }`) and HTTP status.

All responses are JSON. Success is `{ ok: true, ... }`; errors are
`{ ok: false, error: { code, message } }` with the HTTP status below.
The client never submits an attendance status — the server derives it.

### `attendance-submit` — public student submission (no auth)

Route: `POST <your Supabase project URL>/functions/v1/attendance-submit`.
No Authorization header / student account required; the caller is
authorized by the short-lived QR token or the classroom passcode.

Public submission page: `?submit=<sessionId>&token=<token>` at the app
root (the full URL is what the QR code encodes — a phone camera opens
it directly; see `src/lib/qr.ts` `buildSubmitUrl`). Without a
`token` in the URL the student enters the 6-digit classroom passcode
instead. The page asks only for a registration number and shows no
session details or other sessions' data.

Since v0.5.4 there is also a passcode entry page at `/submit` (no
session in the URL) for students who cannot scan the QR code: the
student types the 6-digit code the lecturer is showing, then the same
attendance form appears. Since v0.5.5 the page checks the code with
the server the moment the student taps Continue (the `validate`
action below) and says right away if it is wrong — a wrong code never
reaches the registration-number form. (In v0.5.4 the code was only
checked for format on the page and verified at submission; the owner
rightly called that rubbish, and v0.5.5 fixed it.)

Validate-only code check (v0.5.5) — same route, no auth:

```json
{ "action": "validate", "passcode": "123456" }
```

The server resolves the passcode exactly as a submission does —
exactly one ACTIVE session, same token-expiry window
(`now < qr_token_issued_at + qr_expires_in_seconds`), and a lecturer
anchor present (a session with no anchor refuses submissions, so its
code must not validate as "correct") — and answers valid/invalid only:

```json
{ "ok": true, "valid": true }
```

A wrong, expired, or inactive code is `401 invalid_token` with the
same message as the passcode-only resolution below; the answer never
contains a session id, a course name, or any detail, and never says
how many sessions matched. Validation is NOT authorization: the full
submission still re-verifies everything (session, expiry, location,
device, duplicate) at submit time.

Rate limit (validate only): this action is a brute-force oracle for a
6-digit code, so it is limited strictly and separately from
submissions — 60 attempts per client IP per minute (keyed on the first
entry of `x-forwarded-for`), plus a 2000-per-minute global cap. The
per-IP number is set above a single student's honest use on purpose:
a whole lecture hall on shared campus WiFi shares one public IP, so
30/min could block honest students who mistype. It stays safe
because a code lives only 5 minutes — at most ~300 guesses per code
lifetime per IP out of 900,000 possible codes — and the global cap
stays as flood protection. Over the limit answers `429 rate_limited`. Like the submission limiter it
is in-memory per function instance (best-effort, resets when the
instance is recycled); a managed limiter in front of the function
remains the production-grade answer.

Request:

```json
{
  "sessionId": "uuid",
  "registrationNumber": "FUT/2022/001",
  "token": "base64url-token-from-qr",
  "passcode": "123456",
  "idempotencyKey": "sub-<sessionId>-<NORMALISED-REG-NO>",
  "latitude": 11.7594,
  "longitude": 9.3392,
  "accuracy": 12,
  "deviceFingerprint": "<64-hex sha256>",
  "selfie": "<base64 jpeg, required>",
  "selfieHash": "<16-hex average hash, required>"
}
```

`token` and `passcode` are alternatives — at least one is required.
`sessionId` is required except in the passcode-only flow, where it
may be omitted: the server then resolves the session from
SHA-256(passcode) among ACTIVE sessions (see below). `idempotencyKey`
is the stable per-(session, student) key built by
`buildIdempotencyKey` in `src/lib/submission.ts`; a retry with the same
key returns the original record instead of creating a second row. In
the passcode-only flow the client has no session id, so it sends an
attempt-scoped random key (`newIdempotencyKey`); a retry is still
deduplicated server-side by the unique constraint on
(session_id, registration_number).

Passcode-only session resolution (v0.5.4): when `sessionId` is
omitted and a passcode is supplied, the server looks up the session
by SHA-256(passcode) with `status = 'active'`. Exactly one match
proceeds with every other check unchanged (expiry, location anchor /
radius / accuracy, device binding, duplicate, headcount flag, rate
limit). Zero matches or more than one match is rejected as
`invalid_token` — the caller is never told how many matched — and a
passcode is never accepted for a Draft, Closed, Finalized or Archived
session. Note: there is no index on `passcode_hash`, so the lookup
scans `attendance_sessions` (one row per lecture session — small).

Phase 4 (v0.5.0) — location and device are mandatory on every
submission, on both the QR-token path and the passcode path.
`latitude` / `longitude` are the student's device coordinates;
`accuracy` is the reported accuracy in metres (null when the device
gives none). `deviceFingerprint` is the SHA-256 hash (64 hex chars)
of the device fingerprint — only the hash is ever sent. The server
rejects a submission without coordinates (`location_required`), more
than 30 m from the lecturer anchor captured at activation
(`outside_location`), with accuracy worse than 100 m
(`location_too_imprecise`), or from a device already bound to another
registration number (`device_bound_to_another_student`) or that
already submitted in this session (`device_already_used`). A session
with no anchor (activated before v0.5.0) refuses submissions until
closed and reopened (`location_not_configured`).

Roster (v0.9.0) — the class-list check, master prompt Rule 4. After
the session is resolved and the idempotency check, before location
and device: when the session's course has students on its class
list (`course_students`), the submitted registration number must be
on that list — otherwise `403 reg_number_not_registered` ("This
registration number is not on this course's list. Ask your lecturer
to add you."). When the list is empty, any registration number is
accepted exactly as before, so a lecturer who has not added
students yet is never locked out. The check is server-side (the
function re-reads the list; at most two cheap indexed queries) and
runs identically on the QR-token path and the passcode path. It runs
after idempotency on purpose, so a retried submission still returns
its original record.

Face check (v0.10.0) — the compulsory live selfie. The request
must carry `selfie` (a small JPEG, base64, at most ~225 KB) and
`selfieHash` (the 16-hex-char average hash of the frame) — both
are required; a submission without them is `400 selfie_required`
("Take a live selfie to submit your attendance. If you have no
front camera, ask your lecturer to add you."). The check runs
after the idempotency check, so a retried submission still returns
its original record, and before any photo upload or record insert
— a refused submission stores no photo. A photo without its hash,
or a hash without its photo, is `400 invalid_request`, as is a
photo that is not a JPEG or is too large. The photo is validated
after the session/token check and stored in the private
`session-selfies` bucket
(`sessions/<session_id>/<record_id>.jpg`) ONLY after every refusal
check has passed — a refused submission stores no photo. After the
insert, the server looks for another record in the SAME session
with the same hash for a DIFFERENT registration number; a match
sets `face_review` on both records — never a rejection, never a
status change. The success response then carries
`"faceReview": true`. Students whose phone has no front camera,
or who cannot use the camera, are added by hand by the lecturer
(manual attendance) — the only fallback, and it needs no selfie.
This is NOT face recognition and NOT identity proof: there are no
student photos on file, so it can never prove the face belongs to
the number. See `docs/ATTENDANCE_RULES.md` and
`docs/SECURITY_MODEL.md`.

Success (200):

```json
{ "ok": true, "duplicate": false, "retried": false, "record": { "id": "uuid", "session_id": "uuid", "registration_number": "FUT/2022/001", "status": "verified", "verification_method": "qr", "submitted_at": "…" } }
```

A duplicate (same reg. no. already in the session, or the same
idempotency key retried) is also 200 with `"duplicate": true`
(`"retried": true` when it matched the idempotency key) and the
existing record — no second row is created. The record status is
always `verified` here, derived server-side; `verification_method` is
`qr` or `passcode`.

Errors:

| HTTP | code | Meaning |
|---|---|---|
| 400 | `invalid_request` | Missing registrationNumber, or neither sessionId nor passcode supplied; or a malformed fingerprint / accuracy; or a selfie sent without its hash (or the reverse), a non-JPEG selfie, or an oversized selfie |
| 400 | `selfie_required` | No live selfie supplied — a selfie is required to submit; students without a front camera are added by hand by the lecturer |
| 400 | `location_required` | No student coordinates supplied — location is mandatory |
| 400 | `location_too_imprecise` | Reported accuracy worse than 100 m |
| 401 | `invalid_token` | Token/passcode hash does not match the session; in the passcode-only flow also when zero or more than one active session matches the passcode; the `validate` action also answers this when the code is expired or its session has no anchor |
| 403 | `outside_location` | Student is more than 30 m from the lecturer anchor |
| 403 | `reg_number_not_registered` | Registration number is not on the course's class list (list is non-empty) |
| 403 | `device_bound_to_another_student` | Device is already bound to a different registration number |
| 404 | `session_not_found` | No such session |
| 409 | `session_not_active` | Session is not `active` |
| 409 | `location_not_configured` | Session has no location anchor (activated before v0.5.0) — close and reopen it |
| 409 | `device_already_used` | This device already submitted in this session |
| 410 | `token_expired` | `now >= qr_token_issued_at + qr_expires_in_seconds` (checked server-side) |
| 429 | `rate_limited` | More than 300 submissions for this session in a minute, or more than 60 `validate` attempts from one client IP in a minute (2000 global per minute) — best-effort, in-memory, single-instance guards, not production-grade distributed limiters |
| 500 | `server_error` / `not_configured` | Server or function-configuration failure |

### `session-transition` — lecturer lifecycle transitions (auth required)

Route: `POST <your Supabase project URL>/functions/v1/session-transition`.
Requires the lecturer's Supabase Auth JWT; the caller must own the
session (checked server-side against `lecturer_profiles` — a lecturer
id in the request body is never trusted).

Request:

```json
{ "sessionId": "uuid", "to": "active", "reason": "optional note", "anchor": { "latitude": 11.7594, "longitude": 9.3392, "accuracy": 12 }, "headcount": 42 }
```

`to` is one of `draft | active | closed | finalized | archived`.
The server enforces the same transition table as
`src/lib/attendance.ts` (`canTransitionSession`); the table is
duplicated in the function because Deno cannot import the frontend
lib — the single source of truth is `docs/ATTENDANCE_RULES.md`.

Phase 4 (v0.5.0): any transition TO `active` requires `anchor` —
the lecturer's device location at activation (latitude −90…90,
longitude −180…180, `accuracy` in metres when the device gives it).
Without a usable anchor the activation is refused (`anchor_required`,
400) — no silent fallback. The anchor is stored on the session with
the capture time; the radius is the server-side default (30 m).
`headcount` (integer ≥ 0, optional, activation only) is the physical
count just taken in the hall, stored on the session; a headcount sent
with a non-activation transition is ignored.

Success (200):

```json
{ "ok": true, "session": { "id": "uuid", "status": "active", "headcount": 42, "qr_expires_in_seconds": 300, "qr_token_issued_at": "…", "anchor_latitude": 11.7594, "anchor_longitude": 9.3392, "anchor_accuracy_meters": 12, "anchor_captured_at": "…", "location_radius_meters": 30 }, "token": "…", "passcode": "123456" }
```

`token` and `passcode` are present ONLY on a transition to `active`
(draft→active activation or closed→active reopen): a fresh secure
token + 6-digit passcode are generated server-side, only their
SHA-256 hashes (+ `issued_at`) are stored, and the values are returned
once in this response. Every transition writes an
`attendance_audit_logs` row (`action: "transition"`, previous/new
status, reason, lecturer, timestamp). A failure to write the audit row
is reported as a `warning` in an otherwise successful response, never
hidden.

Finalize (v0.10.0): a transition to `finalized` also deletes the
session's selfie photos from the private `session-selfies` bucket
and clears `selfie_path` on the session's records (the hash and the
review flag stay). If the deletion fails, the finalize still stands
but the failure is reported as a `warning`, never hidden.

Errors:

| HTTP | code | Meaning |
|---|---|---|
| 400 | `invalid_request` | Missing sessionId or invalid `to` |
| 400 | `anchor_required` | Activation without a usable lecturer location anchor |
| 401 | `unauthorized` | No valid lecturer session |
| 403 | `forbidden` | Session belongs to another lecturer |
| 404 | `session_not_found` | No such session |
| 409 | `invalid_transition` | Transition not allowed from the current status |

### `manual-attendance` — lecturer manual add + correction (auth required)

Route: `POST <your Supabase project URL>/functions/v1/manual-attendance`.
Requires the lecturer's JWT and session ownership (as above).
Finalized / archived sessions are read-only: all shapes are refused.

Manual add — request:

```json
{ "sessionId": "uuid", "registrationNumber": "FUT/2022/009", "reason": "Student arrived without a phone" }
```

Inserts a record with status `manual`, `verification_method:
"manual"`, `manual_reason` = reason. The registration number is
normalised server-side (trim + uppercase). A duplicate maps to 409
`duplicate_registration`.

Correction — request:

```json
{ "sessionId": "uuid", "recordId": "uuid", "newStatus": "rejected", "reason": "Wrong student" }
```

`newStatus` must be one of `verified | manual | pending | rejected |
suspicious`.

Face review (v0.10.0) — request:

```json
{ "sessionId": "uuid", "recordId": "uuid", "faceReview": "confirm", "reason": "Same face as FUT/2022/001, checked the photos" }
```

`faceReview` is `confirm` or `dismiss`. Confirm means the lecturer
agrees the same face was used for two numbers — the record becomes
`suspicious` and the flag is cleared. Dismiss means the lecturer
checked and it is fine — the status stays as it was and the flag is
cleared. A record that is not flagged is refused with 409
`face_review_not_flagged`. Exactly one of the four shapes is
accepted per call.

Bulk mark all as arrived (v0.12.0) — request:

```json
{ "sessionId": "uuid", "bulkMarkAll": true, "reason": "Marked all as arrived by lecturer" }
```

The server re-reads the course's class list and the session's
records — the client never decides who gets marked. Every student
on the list with no record in this session yet is inserted as a
`manual` record (`verification_method: "manual"`,
`manual_reason` = the shared reason). Anyone who already has a
record (verified or manual) is skipped, so nobody is ever counted
twice and a second run marks nobody new. A course with no class
list is refused with 409 `empty_class_list`. One audit row per
marked record (`action: "bulk_manual_attendance"`). Success (200):

```json
{ "ok": true, "marked": 40, "skipped": 2, "failed": 0, "failedNumbers": [] }
```

`marked` / `skipped` / `failed` are the counts, and
`failedNumbers` names the registration numbers that could not be
marked, so a partial failure is never a silent half-result: if a
student submits between the list read and the insert, that number
is just skipped on retry, and a real per-row error is counted as
failed. If nothing could be marked at all, the function answers a
plain 500, not a success.

Success (200) for the other shapes: `{ "ok": true, "record": { … } }`. All shapes write
an `attendance_audit_logs` row (`action: "manual_attendance"`,
`"correction"`, `"face_review_confirmed"`,
`"face_review_dismissed"` or `"bulk_manual_attendance"`,
previous/new status, reason, lecturer,
timestamp); an audit-write failure is reported as a `warning`, never hidden.

Errors: 400 `invalid_request` (missing reason, more than one shape
or none, invalid `newStatus` or `faceReview`), 401 `unauthorized`,
403 `forbidden`, 404 `session_not_found` / `record_not_found`, 409
`session_read_only` (finalized/archived), `duplicate_registration`
(manual add), `face_review_not_flagged` (face review) or
`empty_class_list` (bulk mark on a course with no class list).

### `contact-notify` — email one saved contact report to the owner (v0.8.3, no auth)

Route: `POST <your Supabase project URL>/functions/v1/contact-notify`.
No Authorization header / account required — the contact form is
public. The caller supplies ONLY the report id; the function
re-reads the report row server-side (service-role client) and sends
one premium HTML + plain-text email via Resend to the owner. The
client never supplies the name, email or message for the email.

Request:

```json
{ "reportId": "uuid" }
```

The server checks, in order:

1. `reportId` is a UUID (anything else: 400 `invalid_request`,
   nothing sent).
2. `RESEND_API_KEY` is configured (missing: 500 `not_configured`,
   nothing sent). The key lives only in the Edge Function
   environment (Supabase dashboard secret, set by the owner) — it
   is never in the repo and never sent to the client.
3. The report row exists (missing: 404 `not_found`, nothing sent).
4. Freshness: the row must be under 10 minutes old (older: 410
   `report_too_old`, nothing sent). A replayed id from hours ago
   can never trigger an email.
5. One email per report id per function instance (best-effort
   in-memory set — the same honesty note as the other in-memory
   guards in this codebase: it resets when the instance is
   recycled, and it is NOT a production-grade distributed dedup. A
   replayed call returns the original Resend id with
   `duplicate: true` and sends nothing new).

The email (built by `supabase/functions/contact-notify/email.ts`):
from `Qovu <onboarding@resend.dev>` (Resend free-tier sender — no
custom domain yet); to `mustaphaabdulsalam1666@gmail.com`, or the
`CONTACT_REPORT_EMAIL` secret when set; subject `New Qovu report:
<Report a problem | Question | Feedback>`. The HTML is a 600px
centred container, white background, ink text, one accent blue —
header with the PNG Qovu logo and wordmark, an accent-blue topic
badge, the reporter's name and email, the message inside a canvas
`#f5f5f7` box, the received time, and a small footer ("Sent from
Qovu — Attendance, verified."). Gmail and most email clients do NOT
render SVG images, so the header image is the PNG logo
(`https://uniattend-x.vercel.app/apple-touch-icon.png`) — never
`logo.svg`. ALL user content (name, email, message) is escaped
before it is placed in the HTML, so a report containing markup
arrives as harmless text, never as markup. A plain-text part is
sent alongside the HTML.

Success (200): `{ "ok": true, "sent": true, "id": "<resend message id>" }`
(`"duplicate": true` on a replayed call — same Resend id, no new
email sent).

Errors:

| HTTP | code | Meaning |
|---|---|---|
| 400 | `invalid_request` | Missing or non-UUID reportId |
| 400 | `invalid_body` | Request body is not valid JSON |
| 404 | `not_found` | No such report |
| 405 | `method_not_allowed` | Not a POST |
| 410 | `report_too_old` | Report is older than 10 minutes — it can no longer trigger an email |
| 500 | `not_configured` | `RESEND_API_KEY` (or the Supabase connection) is not configured |
| 500 | `server_error` | The report row could not be read |
| 502 | `email_failed` | Resend refused the email, or could not be reached |

The contact form (`/contact`) calls this function fire-and-forget
after the report saves: the report id is generated client-side (a
random UUID) and included in the insert, because there is
deliberately no public SELECT policy on `contact_reports` and the
client therefore cannot read the id back. If the function is
unreachable, errors, or the email fails, the report stays saved and
the user still sees the normal success message — the email must
never fail the report. The outcome is only logged to the console.

## Edge Functions (Phase 3 exports — built client-side instead, v0.14.0)

No `export-report` function exists, deliberately: exports are built
client-side from the same RLS-scoped queries as the UI, and Postgres
RLS (own `lecturer_id`, own assignments) is the server-side
enforcement — a raw API call cannot read another lecturer's rows.
Do not call an endpoint that does not exist.

| Function | Purpose |
|---|---|
| _(none)_ | Exports need no function. |

## Errors

- Unconfigured Supabase (connection values missing): the app shows a configuration
  empty state, not a crash and not fake data. Edge Function calls
  return `{ ok: false, unavailable: true, error: { code:
  "not_configured", … } }` and the UI says the operation needs a live
  backend. The public submission page (`?submit=…`) shows the same
  honest unavailable state.
- Unauthorized (no assignment): the query returns no rows; the UI
  shows the empty state. The client must not invent a fallback.
- Validation failure (e.g. week outside 1–15): rejected before any
  network call, with a field-level message.

## CSV contract (Phase 3 — built v0.14.0, see `lib/exports.ts`)

Columns, in order: registration number, student name (if available
and authorized), department, course code, academic session, semester,
week, attendance title, lecture date, attendance status,
verification method, submission timestamp, manual attendance reason
(if applicable). Values are escaped per RFC 4180 and formula
injection is neutralized (see `lib/csv.ts`). The file starts with a
UTF-8 BOM so Excel opens it as UTF-8.
