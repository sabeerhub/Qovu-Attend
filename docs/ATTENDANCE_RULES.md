# Attendance Rules — UniAttend

## Calendar

- A semester has exactly 15 teaching weeks by default (Week 1–Week 15).
- Weeks are configurable by academic administrators via the academic
  session and semester dates; the 15-week default is not hardcoded
  in a way that prevents configuration, but the week number on a
  session is always validated to 1–15.
- History is organized by academic session, semester and week.

## Sessions

- A lecturer may create multiple attendance sessions for the same
  course in the same week. Each session is a separate attendance
  record collection.
- Required fields: department (authorized assignment only), course,
  academic session, semester, week number, attendance title / lecture
  topic, lecture date, lecture room, expected/physically counted
  student total, QR expiration duration, classroom verification
  settings.
- Lecturer, creation timestamp and status are recorded automatically
  by the system, never supplied by the client.

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
must be recorded in the audit log.

## Records

- One student registration number per attendance session. Enforced by
  the database unique constraint on `(session_id,
  registration_number)` and by server-side checks.
- Attendance status is decided server-side. The client never submits
  a trusted status; it submits a registration number (and, in later
  phases, a token), and the server derives the status.
- Record statuses: `verified`, `manual`, `pending`, `rejected`,
  `suspicious`.

## Headcount vs. submissions

- During an active session the dashboard shows physical headcount,
  verified, manual, pending, rejected, suspicious, and the difference
  between headcount and submissions.
- **A headcount discrepancy is not automatic evidence of fraud.**
  It is a number to review, not a verdict.

## Manual attendance and corrections

- A lecturer may manually add a student, resolve a pending case, or
  correct a mistake — always with a reason.
- Every manual entry and correction records lecturer, timestamp,
  reason, and previous/new status in `attendance_audit_logs`.
- Finalized historical records cannot be silently rewritten.
