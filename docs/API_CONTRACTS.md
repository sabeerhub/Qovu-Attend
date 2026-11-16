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
  "deviceFingerprint": "<64-hex sha256>"
}
```

`token` and `passcode` are alternatives — at least one is required.
`idempotencyKey` is the stable per-(session, student) key built by
`buildIdempotencyKey` in `src/lib/submission.ts`; a retry with the same
key returns the original record instead of creating a second row.

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
| 400 | `invalid_request` | Missing sessionId / registrationNumber, or neither token nor passcode supplied; or a malformed fingerprint / accuracy |
| 400 | `location_required` | No student coordinates supplied — location is mandatory |
| 400 | `location_too_imprecise` | Reported accuracy worse than 100 m |
| 401 | `invalid_token` | Token/passcode hash does not match the session |
| 403 | `outside_location` | Student is more than 30 m from the lecturer anchor |
| 403 | `device_bound_to_another_student` | Device is already bound to a different registration number |
| 404 | `session_not_found` | No such session |
| 409 | `session_not_active` | Session is not `active` |
| 409 | `location_not_configured` | Session has no location anchor (activated before v0.5.0) — close and reopen it |
| 409 | `device_already_used` | This device already submitted in this session |
| 410 | `token_expired` | `now >= qr_token_issued_at + qr_expires_in_seconds` (checked server-side) |
| 429 | `rate_limited` | More than 300 submissions for this session in a minute (best-effort, in-memory, single-instance guard — not a production-grade distributed limiter) |
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
Finalized / archived sessions are read-only: both shapes are refused.

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
suspicious`. Exactly one of the two shapes is accepted per call.

Success (200): `{ "ok": true, "record": { … } }`. Both shapes write
an `attendance_audit_logs` row (`action: "manual_attendance"` or
`"correction"`, previous/new status, reason, lecturer, timestamp); an
audit-write failure is reported as a `warning`, never hidden.

Errors: 400 `invalid_request` (missing reason, both/neither shape,
invalid `newStatus`), 401 `unauthorized`, 403 `forbidden`, 404
`session_not_found` / `record_not_found`, 409 `session_read_only`
(finalized/archived) or `duplicate_registration` (manual add).

## Edge Functions (Phase 3, planned — not implemented)

| Function | Purpose |
|---|---|
| `export-report` | Generate PDF / CSV scoped to the lecturer's authorized records. |

No export function exists yet in `supabase/functions/`. Do not call
an endpoint that does not exist.

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

## CSV contract (Phase 3)

Columns, in order: registration number, student name (if available
and authorized), department, course code, academic session, semester,
week, attendance title, lecture date, attendance status,
verification method, submission timestamp, manual attendance reason
(if applicable). Values are escaped per RFC 4180 and formula
injection is neutralized (see `lib/csv.ts`).
