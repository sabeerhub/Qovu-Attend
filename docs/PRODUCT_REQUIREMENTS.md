# Product Requirements — UniAttend Lecturer Portal

Source: Lecturer Dashboard — Complete Product Specification v1.0
(`docs/LECTURER_DASHBOARD_SPEC.md`). This document restates that spec in
requirements form. It adds nothing beyond the spec.

## Product

University Attendance Management System. Module: Lecturer Portal.
Primary users: lecturers and authorized university administrators.
Academic structure: 15-week semester.

## Objective

A centralized interface for managing teaching assignments, departments,
courses, lecture rooms, attendance sessions, student attendance records,
historical reports and attendance exports.

Core principle: every attendance record must belong to a specific lecturer,
department, course, academic session, semester, week and lecture session.

## Navigation (7 sections)

1. Overview
2. My Departments
3. My Courses
4. Attendance Sessions
5. Attendance History
6. Reports & Exports
7. Profile & Settings

Responsive, mobile-first; desktop and tablet optimized.

## Functional requirements

### Overview

- Summary statistics: assigned departments, assigned courses, attendance
  sessions, attendance records, upcoming/scheduled lectures (only if
  timetable integration is enabled), recent attendance activity, courses
  requiring attention.
- Department filter: statistics filtered to a selected department.
- Statistics must be calculated from actual database records, never
  hardcoded values.

### Departments

- A lecturer accesses multiple departments, subject to university
  assignment.
- Each department shows: name, faculty, assigned courses, academic
  session, department-specific attendance history.
- Selecting a department opens its own workspace.
- Department creation and assignment are controlled by the university
  administrator. Lecturers cannot create departments or grant themselves
  assignments.

### Courses

Each course has: title, code, department, faculty, academic level,
semester, credit unit (where applicable), academic session, assigned
lecturer(s).

- Lecturers only see courses assigned to them.
- A course may have more than one assigned lecturer if the institution
  permits it. Access is controlled by the assignment.

### Academic calendar

- Each semester contains exactly 15 configurable teaching weeks by
  default (Week 1–Week 15).
- Academic administrators configure academic session and semester dates.
- History is organized by academic session, semester and week.
- The week number is selected by the lecturer when creating a session;
  the system validates it against the selected academic calendar.

### Attendance sessions

- Multiple sessions per course per week are allowed (e.g. CIT 301,
  Week 5: three separate sessions).
- Required fields: department (from authorized assignments), course,
  academic session, semester, week number, attendance title / lecture
  topic, lecture date, lecture room, expected/physically counted student
  total, QR expiration duration, classroom verification settings.
- The system records lecturer, creation timestamp and session status
  automatically.
- Lifecycle: Draft → Active → Closed → Finalized → Archived.
- Starting a session generates a secure, short-lived QR token and shows
  the classroom passcode (Phase 2).
- Finalized records are read-only for ordinary use. Corrections require
  an authorized action and an audit log entry.

### Attendance monitoring (Phase 2)

- During an active session: physical headcount, verified attendance,
  lecturer-authorized manual attendance, pending submissions, rejected
  submissions, suspicious submissions requiring review, and the
  difference between headcount and submissions.
- A headcount discrepancy must NOT automatically be treated as fraud.
- Lecturer can: view submitted registration numbers, review verification
  status, manually add a student with a reason, resolve pending cases,
  correct a mistake with a reason, close and finalize a session.
- Every manual entry and correction records lecturer, timestamp, reason
  and previous/new status.

### Attendance history (Phase 3 — built v0.14.0)

- Permanent core feature. Lecturers can revisit completed sessions at
  any time within their authorized access.
- Filters: department, course code, academic session, semester, week
  number, date range, attendance title, session status.
- Historical session detail shows title, department/faculty, course,
  session/semester, week, date/time, room, lecturer, headcount, verified,
  manual, pending/rejected, registration numbers and statuses,
  verification details where permitted, and audit history.
- Finalized historical records cannot be silently rewritten.

Built in v0.14.0 with department, course, status and date-range
filters; opening a session shows the session monitor (counts,
records, manual attendance, lifecycle, exports). Semester, week
and title filters and an audit-history view are not built yet.

### Reports and exports (Phase 3 — built v0.14.0)

- PDF: clean printable A4 report — university name/logo, faculty and
  department, course code/title, session/semester, week, title, date and
  room, lecturer name, headcount, attendance summary, registration
  numbers, status, signature area, generation date. Professional print
  layout, page numbers, repeated table headers on multi-page reports.
- CSV / Excel-compatible: registration number, student name (if available
  and authorized), department, course code, academic session, semester,
  week, attendance title, lecture date, attendance status, verification
  method, submission timestamp, manual attendance reason if applicable.
  Consistent date formats, properly escaped values.
- Export scopes: one session; all sessions for a course; a selected
  week; an entire semester for a course; a selected department's
  authorized records.
- Exports respect lecturer permissions and never expose another
  lecturer's records without authorization.

Built in v0.14.0 for two scopes — one session, and all sessions for a
course — as a printable A4 report (browser print, no PDF library) and
a formula-safe CSV with a UTF-8 BOM. Week, semester and department
scopes are not built yet. The report header has no university name or
logo: none is configured in Qovu, and nothing is invented — a
university name/logo setting is still an open question for the owner.

## Non-functional requirements

- No student account required for the MVP.
- Free-tier infrastructure only, within published quotas.
- Accessible buttons, forms and status indicators; clear empty, loading,
  error and success states.

## Acceptance criteria (pilot readiness)

1. Lecturer can access multiple assigned departments.
2. Each department displays only its authorized courses.
3. A semester supports 15 weeks.
4. Multiple sessions per course per week are possible.
5. Every session has a unique identifier and attendance title.
6. Student attendance cannot be duplicated within the same session.
7. Lecturer can monitor attendance while a session is active.
8. Manual attendance and corrections are auditable.
9. Finalized sessions remain available in history.
10. History filters by department, course, semester, week and date.
11. Lecturer can generate a printable PDF report.
12. Lecturer can export authorized records to CSV.
13. Department and lecturer access restrictions are enforced by the
    backend.
14. Portal works on mobile and desktop.
