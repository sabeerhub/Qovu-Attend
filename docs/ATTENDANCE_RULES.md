# Attendance Rules — UniAttend

## Calendar (Phase 1, implemented 2026-11-15)

- A semester has exactly 15 teaching weeks by default (Week 1–Week 15).
- Weeks are configurable by academic administrators via the academic
  session and semester dates; the 15-week default is not hardcoded
  in a way that prevents configuration, but the week number on a
  session is always validated to 1–15.
- **Week derivation (implemented in `src/lib/calendar.ts`):** week 1
  is the first 7 days starting on the semester `start_date`; week N
  covers days 7·(N−1) … 7·N−1 after the start date. A lecture date
  that falls outside the semester dates, or beyond week 15, has no
  derived week — it is only used to *suggest* a week in the session
  form. Since v0.4.1 (product-owner decision 2026-11-16, overriding
  spec §6) the lecturer sets the lecture date, start time and week
  freely: an out-of-semester date is allowed and the chosen week
  need not match the derived week. Session creation no longer
  cross-checks the week against the date or rejects dates outside
  the semester.
- History is organized by academic session, semester and week.

## Sessions

- A lecturer may create multiple attendance sessions for the same
  course in the same week. Each session is a separate attendance
  record collection.
- Required fields: department (authorized assignment only), course,
  academic session, semester, week number, attendance title / lecture
  topic, lecture date, lecture start time, lecture room, expected/physically counted
  student total, QR expiration duration, classroom verification
  settings.
- Lecturer, creation timestamp and status are recorded automatically
  by the system, never supplied by the client.
- **Classroom verification settings (Phase 2, implemented):** when a
  session is activated (draft→active, or closed→active on reopen) the
  `session-transition` Edge Function generates a secure random QR
  token and a 6-digit classroom passcode server-side. Only their
  SHA-256 hashes (`qr_token_hash`, `passcode_hash`) and
  `qr_token_issued_at` are stored (migration
  `20261115010000_session_qr_tokens.sql`); the values are returned
  once to the lecturer and shown with the QR code. Students submit at
  `?submit=<sessionId>&token=<token>` (or enter the passcode); expiry
  is checked server-side from `qr_token_issued_at` +
  `qr_expires_in_seconds`.
- **Headcount confirmed at activation (Phase 4, v0.5.0):** the
  headcount entered at session creation is only an expected number.
  The lecturer counts the real bodies in the hall just before
  projecting the QR code, and confirms (or corrects) the count in the
  monitor when starting the session. The confirmed count is stored on
  the session with the activation and is the number the
  headcount-vs-submissions flag compares against.

## Smart verification (Phase 4 slice 1, v0.5.0 — implemented, untested live)

The intended lecture flow: the lecturer takes the physical headcount,
then projects the QR code; students scan it (or use the 6-digit
passcode beside it when their phone has no camera) to mark
attendance. Students never register — public submission, registration
number only.

- **Lecturer-anchored location.** When a session is activated, the
  lecturer's device location is captured in the browser and stored on
  the session (`anchor_latitude`, `anchor_longitude`,
  `anchor_accuracy_meters`, `anchor_captured_at`). An activation
  without a usable location is refused — no silent fallback. The
  radius is **30 metres** (product-owner rule 2026-11-16: if the
  student and the lecturer are in the same location and the distance
  is not above 30 m, the student is eligible; above 30 m the
  submission is rejected).
- **Mandatory student location.** Every submission must carry the
  student's device coordinates. A submission without coordinates is
  refused (`location_required`). The server computes the Haversine
  distance from the session anchor and rejects beyond the radius
  (`outside_location`), or when the reported accuracy is worse than
  100 m (`location_too_imprecise`). The check applies identically to
  the QR-token path and the passcode path. Client-side distance math
  is display-only; the server decides. Sessions activated before
  v0.5.0 have no anchor and refuse submissions until closed and
  reopened.
- **Patient GPS wait, no rough fallback (v0.10.1).** Phone GPS
  works without mobile data — it listens to satellites, not the
  internet — but a cold fix without data takes 60–120 seconds, so
  the app waits up to 2 minutes for a good fix and shows it is
  still trying ("Waiting for your location… 25s — this can take a
  minute without mobile data. Stay near a window."). A fix worse
  than 100 m is never accepted: there is no network fallback,
  because a rough fix would only be refused anyway. The accuracy
  is checked right after capture, BEFORE the selfie — tapping
  Allow only gives permission, it does not mean the fix is good,
  so a rough fix warns immediately instead of wasting the selfie.
  If no good fix arrives in 2 minutes, the student sees the
  couldn't-lock screen ("Try again", or go to the lecturer, who
  adds them by hand) — never a dead end. A denied permission
  still fails fast with re-allow instructions. The same patient
  wait applies to the lecturer's activation anchor.
- **Device binding.** Each submission carries the SHA-256 hash of a
  device fingerprint (screen, user agent, timezone, hardware,
  canvas — only the hash ever leaves the phone). The first
  submission binds a device to one registration number, across all
  sessions; a later submission from the same device for a different
  number is refused, and one device may submit once per session. A
  per-browser localStorage flag is a UX hint only. Manual attendance
  stays lecturer-attested, with no location/device checks.
- **Face check — live selfie (v0.10.0, implemented, untested live).**
  After location and device are verified, the student must take a
  live selfie before the final submit. The photo is a small
  JPEG (max ~480 px wide) taken with the front camera; the server
  also receives its 8x8 average hash (16 hex chars, computed on the
  phone from the frame's pixels). If the same hash is submitted for
  two different registration numbers in the SAME session, both
  records are flagged (`face_review`) for the lecturer to review —
  never auto-rejected, never a refusal, never a status change. The
  lecturer sees the photo (short-lived signed URL, only for the
  assigned lecturer) with the plain words "Same face used for
  another number in this class — check it", and confirms (record
  becomes `suspicious`, audit-logged) or dismisses (flag cleared,
  status unchanged, audit-logged) with a reason.
- **A live selfie is required for self-submission.** A submission
  without a selfie is refused server-side (`selfie_required`).
  There is no way to submit on your own without one. A student
  whose phone has no front camera, or who cannot use the camera,
  goes to the lecturer, who adds them by hand (manual attendance)
  — that is the only fallback, and it needs no photo. A denied or
  missing camera stops the form with a plain message; it never
  submits without a photo.
- **Photos are deleted after the session.** Photos live in the
  private `session-selfies` Storage bucket under
  `sessions/<session_id>/<record_id>.jpg`. When a session is
  Finalized, the photos are deleted and `selfie_path` is cleared on
  the records; the hash and the review flag stay (a photo cannot be
  rebuilt from a hash). Only the Edge Functions (service role)
  write or delete photos; lecturers may read only their own
  sessions' photos, enforced by a Storage policy.
- **Honest limit — this is NOT face recognition and NOT identity
  proof.** There are no student photos on file, so the check can
  never prove the face belongs to the registration number. It only
  catches the same face used twice in one session. A similar-looking
  photo (twins, family, a bad hash collision, a covered camera)
  can flag an honest student — which is exactly why a flag is
  review-only. A uniform frame (covered camera, blank wall) has no
  usable hash and runs no duplicate check.
- **Honest limits.** GPS can be spoofed with mock-location apps,
  indoor GPS drifts 10–20 m, and a fingerprint is a hashed
  deterrent, not a proof of identity. These checks verify the phone,
  not the person. The face check verifies that one face was not
  used for two numbers in one class — it does not verify who the
  face belongs to.

## Lifecycle

```
draft → active → closed → finalized → archived
```

- `draft`: created, not yet collecting attendance.
- `active`: collecting attendance; QR token / passcode live.
- `closed`: attendance window ended (expired or manually ended).
- `finalized`: read-only for ordinary use. Corrections require an
  authorized action and an audit log entry.
- `archived`: retained for permanent history, no longer in active lists.

Allowed transitions (also enforced in `lib/attendance.ts` and tested):

| From | To |
|---|---|
| draft | active, archived |
| active | closed |
| closed | finalized, active |
| finalized | archived |
| archived | — (terminal) |

`closed → active` (reopen) is allowed only before finalization, and
must be recorded in the audit log. Any transition to `active`
(activation or reopen) issues a fresh QR token + passcode server-side
(Phase 2); the previous code stops working.

## Records

- One student registration number per attendance session. Enforced by
  the database unique constraint on `(session_id,
  registration_number)` and by server-side checks.
- Attendance status is decided server-side. The client never submits
  a trusted status; it submits a registration number (and, in later
  phases, a token), and the server derives the status.
- Record statuses: `verified`, `manual`, `pending`, `rejected`,
  `suspicious`.

## Refused tries (v0.16.0 — implemented, untested live)

- **A refused submission is logged, so the lecturer can see it.**
  Before v0.16.0 a refusal left no trace: the block worked, but
  nothing was ever written anywhere, and the session monitor only
  reads `attendance_records`. Now every logged refusal writes one
  row to `attendance_attempts` (session, registration number,
  reason, time), shown in the session monitor's "Refused tries"
  section — newest first, with the reason in plain words.
- **Logged:** a second submission (`already_submitted`), a device
  that already submitted in this session (`device_already_used`),
  a device registered to another number
  (`device_registered_to_other`), outside the hall (`outside_hall`),
  location too imprecise (`location_imprecise`), a number not on
  a non-empty class list (`not_on_class_list`), and a submission
  with no selfie at all (`selfie_missing`). The student sees
  exactly the same refusal message as before; nothing about the
  log ever leaks to the student.
- **Never logged:** wrong-passcode guesses from the `validate`
  action (no registration number there, and they are rate-limited
  probes); malformed selfie input; session/token problems; rate
  limits; missing-field requests.
- **A refused try is never attendance.** It is never counted in
  any summary, never changes a headcount difference, and never
  affects eligibility. It is a record of what happened — not
  proof of cheating. The lecturer decides what a try means.
  Logging is best-effort: if the insert fails, the original
  refusal still stands.

## Student roster (v0.9.0 — implemented, untested live)

- Each course has a class list: registration numbers (and optional
  names) the lecturer adds one by one or imports from a CSV file
  (with a preview first — nothing is saved until confirmed).
- Registration numbers are stored normalized (trimmed + uppercased),
  so `u19/cs/001` and `U19/CS/001` are the same student; one student
  appears once per course.
- **Roster rule (master prompt Rule 4), enforced server-side in
  `attendance-submit`:** when a course's class list is not empty,
  only registration numbers on that list can submit attendance. A
  number that is not on the list is refused with
  `reg_number_not_registered` ("This registration number is not on
  this course's list. Ask your lecturer to add you.").
- **Empty-list fallback (deliberate):** when a course has no students
  on its list yet, any registration number is accepted exactly as
  before — a lecturer who has not added students is never locked out
  of their own hall. The moment the first student is added, the list
  starts being enforced.
- Manual attendance by the lecturer is not roster-checked: the
  lecturer is in the hall and authorizes it with a reason.

## Eligibility — the 75% check (v0.11.0 — implemented, untested live)

- For each course, every student gets an attendance percentage:
  sessions attended divided by sessions actually held.
- **The bar is 75% by default.** The lecturer can change it for a
  course (a whole number from 0 to 100), saved through the
  server-side `set_eligibility_threshold` RPC, which refuses any
  course the lecturer is not assigned to. The range is also
  enforced by a database CHECK constraint.
- **What counts as "held":** only a session that is finished and
  locked — Finalized or Archived. Draft, Active and Closed
  sessions do not count yet, because attendance can still change
  in them. There is no cancelled session status in this codebase,
  so there is nothing extra to exclude.
- **What counts as "attended":** a record with status `verified`
  or `manual`. A student added by hand by the lecturer counts as
  present, the same as a verified one. `pending`, `rejected` and
  `suspicious` do not count as present.
- **The exact percentage decides, not the rounded one:** 74.6% is
  below a 75% bar. The displayed number is rounded to one decimal
  for reading only.
- **Risk bands (they move with the bar):** below the bar; close to
  the bar — from the bar up to 9 points above it (so 75–84% when
  the bar is 75%); safe — 10 or more points above the bar.
  Students below the bar are not eligible to write the exam.
- **Week view (W1–W15):** for each week, a student shows attended
  when they were present in at least one finished session that
  week, missed when there were finished sessions that week and
  they were present in none, and no session when the week had no
  finished sessions. The attended/held counts stay per session.
- **Who gets a row:** every student on the course's class list
  (a student with no records shows 0%), plus any registration
  number that has records but is not on the list (courses without
  a list). The percentage is computed, never stored — a stored
  percentage would go stale the moment a session is finalized.
- **No finished sessions yet:** eligibility appears after the
  first session is finalized. Until then the view says so plainly.

## Headcount vs. submissions

- During an active session the dashboard shows physical headcount,
  verified, manual, pending, rejected, suspicious, and the difference
  between headcount and submissions.
- **A headcount discrepancy is not automatic evidence of fraud.**
  It is a number to review, not a verdict.
- **Headcount-mismatch flag (Phase 4, v0.5.0):** when verified +
  manual submissions exceed the confirmed physical headcount, the
  monitor shows a review flag ("Submissions exceed the physical
  headcount — review"). It is display only — it never changes a
  status, never rejects a submission, and never calls a student a
  fraud. It compares against the headcount confirmed at activation.

## Manual attendance and corrections

- A lecturer may manually add a student, resolve a pending case, or
  correct a mistake — always with a reason.
- Every manual entry and correction records lecturer, timestamp,
  reason, and previous/new status in `attendance_audit_logs`.
- Finalized historical records cannot be silently rewritten.

### Mark all as arrived (v0.12.0 — implemented, untested live)

- When the lecturer counts everyone in the hall and has no time to
  add students one by one, one tap in the session workspace marks
  every student on the course's class list as arrived.
- **Confirm first.** Before anything is saved, the screen shows the
  numbers in plain words: students on the list, how many already
  submitted (these will be skipped), how many will be marked, and
  the session headcount. When verified + manual after the mark
  would pass the headcount, the confirm step says so.
- **Who gets marked:** every student on the course's class list
  with no record in this session yet. Anyone who already has a
  record — verified or manual — is skipped, so nobody is ever
  counted twice, and running it a second time marks nobody new.
- **With no class list there is nobody to mark:** the button does
  not appear, and the screen says to add the class list first.
- **Same session rule as a single manual add:** only finalized and
  archived sessions refuse it. The mark is server-side, never a
  client loop — the function re-reads the list and the records, so
  the client never decides who gets marked.
- **One shared reason:** every marked record carries "Marked all as
  arrived by lecturer", and each one gets its own audit-log row
  (`bulk_manual_attendance`), exactly like a single manual add.
- **A partial failure is never a silent half-result:** the answer
  reports how many were marked, how many were skipped, and how
  many failed, with the numbers that failed — so the lecturer can
  try again or add the failed ones by hand.
- **Headcount still applies:** after the mark, verified + manual
  is compared with the headcount exactly as before, and a mismatch
  flags the session for review — never automatic fraud.
