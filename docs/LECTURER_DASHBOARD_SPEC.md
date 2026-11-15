# Lecturer Dashboard — Complete Product Specification

Product: University Attendance Management System
Module: Lecturer Portal
Version: 1.0
Academic structure: 15-week semester
Primary users: Lecturers and authorized university administrators

---

1. Product objective

The Lecturer Dashboard provides a centralized interface for managing teaching assignments, departments, courses, lecture rooms, attendance sessions, student attendance records, historical reports and attendance exports.

A lecturer may teach multiple courses across multiple departments. Each department must have independent course and attendance records, while the lecturer can access all their authorized assignments through one account.

Core principle: Every attendance record must belong to a specific lecturer, department, course, academic session, semester, week and lecture session.

2. Dashboard navigation

The lecturer portal should contain:

1. Overview
2. My Departments
3. My Courses
4. Attendance Sessions
5. Attendance History
6. Reports & Exports
7. Profile & Settings

The interface must be responsive, mobile-first and optimized for desktop and tablet use.

3. Overview dashboard

Display summary statistics:

- Total assigned departments.
- Total assigned courses.
- Total attendance sessions.
- Total attendance records.
- Upcoming or scheduled lectures, if timetable integration is enabled.
- Recent attendance activity.
- Courses requiring attention.

The lecturer must be able to select a department and view statistics filtered to that department.

Dashboard statistics must be calculated from actual database records, not hardcoded values.

4. Department management

A lecturer can access multiple departments, subject to their university assignments.

Each department should display:

- Department name.
- Faculty name.
- Assigned courses.
- Academic session.
- Department-specific attendance history.

Example:

Faculty of Computing

- Information Technology
- Computer Science
- Software Engineering

Selecting a department opens its own workspace.

Department creation and assignment are controlled by the university administrator. Lecturers cannot independently create university departments or grant themselves teaching assignments.

5. Course management

Each course must have:

- Course title.
- Course code.
- Department.
- Faculty.
- Academic level.
- Semester.
- Credit unit, where applicable.
- Academic session.
- Assigned lecturer(s).

Example:

Course code| Course title| Department| Level
CIT 301| Web Technology| Information Technology| 300
CIT 305| Database Systems| Information Technology| 300
CSC 301| Computer Architecture| Computer Science| 300

Lecturers only see courses assigned to them.

A course can have more than one assigned lecturer if the institution permits it. Access must be controlled by the lecturer's assignment.

6. Academic calendar and weekly structure

Each academic semester contains exactly 15 configurable teaching weeks by default.

Week numbers:

- Week 1
- Week 2
- Week 3
- Week 4
- Week 5
- Week 6
- Week 7
- Week 8
- Week 9
- Week 10
- Week 11
- Week 12
- Week 13
- Week 14
- Week 15

Academic administrators configure the academic session and semester dates.

Each course's attendance history is organized by academic session, semester and week.

The week number is selected by the lecturer when creating a session, but the system should validate it against the selected academic calendar.

7. Attendance session creation

Lecturers can create multiple attendance sessions for the same course during the same week.

For example:

CIT 301 — Week 5:

- Session 1: Introduction to React Hooks.
- Session 2: State and Props.
- Session 3: Practical React Development.

Each session is a separate attendance record collection.

Required session fields

- Department (selected from authorized assignments).
- Course.
- Academic session.
- Semester.
- Week number.
- Attendance title / lecture topic.
- Lecture date.
- Lecture room.
- Expected or physically counted student total.
- QR expiration duration.
- Classroom verification settings.

The system automatically records the lecturer, creation timestamp and session status.

Session lifecycle

1. Draft
2. Active
3. Closed
4. Finalized
5. Archived

A lecturer starts the session when ready to collect attendance. The system generates a secure, short-lived QR token and displays the classroom passcode.

The lecturer closes the session after the attendance window expires or when manually ending it.

Finalized records are read-only for ordinary use. Corrections require an authorized action and must be recorded in the audit log.

8. Attendance monitoring

During an active session, display:

- Physical headcount.
- Verified attendance.
- Lecturer-authorized manual attendance.
- Pending submissions.
- Rejected submissions.
- Suspicious submissions requiring review.
- Difference between headcount and attendance submissions.

Example:

Category| Count
Physical headcount| 60
Verified| 54
Manual| 4
Pending review| 2

The system must not automatically treat a headcount discrepancy as evidence of fraud.

The lecturer can:

- View submitted student registration numbers.
- Review verification status.
- Manually add a student with a reason.
- Resolve pending cases.
- Correct an attendance mistake with a reason.
- Close and finalize a session.

Every manual entry and correction must record the lecturer, timestamp, reason and previous/new status.

9. Attendance history

This is a permanent core feature.

Lecturers must be able to revisit completed attendance sessions at any time within their authorized data access.

History filters

- Department.
- Course code.
- Academic session.
- Semester.
- Week number.
- Date range.
- Attendance title.
- Session status.

Historical session details

Opening a historical session displays:

- Session title.
- Department and faculty.
- Course code and title.
- Academic session and semester.
- Week number.
- Date and time.
- Lecture room.
- Lecturer.
- Physical headcount.
- Verified attendance.
- Manual attendance.
- Pending and rejected records.
- Student registration numbers and their attendance statuses.
- Verification details where permitted.
- Audit history.

Lecturers must not be able to silently rewrite finalized historical records.

10. Reports and exports

The system supports two export formats.

A. PDF

Generate a clean, printable A4 attendance report.

The PDF should contain:

- University name and logo.
- Faculty and department.
- Course code and title.
- Academic session and semester.
- Week number.
- Attendance title.
- Date and lecture room.
- Lecturer's name.
- Physical headcount.
- Attendance summary.
- Student registration numbers.
- Attendance status.
- Lecturer's signature area.
- Report generation date.

PDF reports must use a professional print layout, with page numbers and repeated table headers for multi-page reports.

B. CSV / Excel-compatible export

CSV exports should contain structured columns:

- Student registration number.
- Student name, if available and authorized.
- Department.
- Course code.
- Academic session.
- Semester.
- Week number.
- Attendance title.
- Lecture date.
- Attendance status.
- Verification method.
- Submission timestamp.
- Manual attendance reason, if applicable.

CSV files must use consistent date formats and properly escape values.

Export scopes

Lecturers can export:

1. One attendance session.
2. All sessions for a particular course.
3. A selected week.
4. An entire semester for a course.
5. A selected department's authorized attendance records.

Exports must respect lecturer permissions and must never expose records belonging to another lecturer without authorization.

11. Database architecture

Recommended Supabase PostgreSQL tables:

Table| Responsibility
"universities"| University records
"faculties"| Faculty structure
"departments"| Department records
"lecturer_profiles"| Lecturer profiles
"lecturer_assignments"| Department and course teaching permissions
"academic_sessions"| Academic years
"semesters"| Semester dates and configuration
"courses"| Course information
"lecture_rooms"| Registered rooms and location settings
"attendance_sessions"| Individual lecture attendance sessions
"attendance_records"| Student attendance submissions
"attendance_audit_logs"| Immutable audit events

Important relationships

- One university has multiple faculties.
- One faculty has multiple departments.
- One department has multiple courses.
- A lecturer can be assigned to multiple departments and courses.
- One course can have multiple attendance sessions.
- Each attendance session belongs to one course and one academic week.
- Each attendance session can contain many attendance records.
- Each attendance record belongs to one attendance session.

Essential database constraints

- A student registration number must be unique within an attendance session.
- A session must reference an existing course and valid academic period.
- Week numbers must be between 1 and 15.
- Lecturers must only access sessions belonging to their authorized assignments.
- Attendance corrections must preserve an audit trail.

Use database Row Level Security (RLS) and server-side authorization. Never rely solely on frontend filtering to protect attendance records.

12. Security and data integrity

- Supabase Auth for lecturer and administrator accounts.
- No student account required for the MVP.
- Validate lecturer assignments on the backend.
- Secure random QR session tokens.
- Server-side session expiry validation.
- Rate limiting on attendance submissions.
- Database uniqueness constraints to prevent duplicate attendance.
- Idempotency protection for retries.
- Audit logging for manual attendance and corrections.
- Restricted access to student information.
- Secure CSV and PDF export permissions.

The lecturer's dashboard must not expose database service-role credentials or privileged backend secrets.

13. UI and design requirements

Design direction:

- Premium minimalist university administration interface.
- White/light background.
- Clear typography and strong visual hierarchy.
- Restrained use of color.
- Consistent spacing.
- Responsive tables and cards.
- Accessible buttons, forms and status indicators.
- Desktop sidebar navigation and mobile navigation.
- Clear empty, loading, error and success states.

Avoid cluttered dashboards, excessive gradients, unnecessary animations and oversized decorative icons.

14. Recommended technology stack

- React + Vite.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Supabase PostgreSQL.
- Supabase Auth.
- Supabase Edge Functions.
- Cloudflare Pages.
- "qrcode" for QR generation.
- "html5-qrcode" for scanning.
- Browser Geolocation API.
- Browser print styles and a PDF-generation library.
- CSV export using a lightweight client-side library or server-side generation.

All infrastructure must initially use free-tier services within their published quotas.

15. Development phases

Phase 1 — Lecturer portal foundation

- Lecturer authentication.
- Department and course assignments.
- Dashboard overview.
- Academic session and semester configuration.
- 15-week academic structure.
- Attendance session creation.

Phase 2 — Attendance operations

- Dynamic QR generation.
- Student registration number submission.
- Session monitoring.
- Manual attendance.
- Duplicate prevention.
- Attendance finalization.

Phase 3 — History and reporting

- Historical attendance records.
- Department and course filters.
- Week-based filtering.
- PDF reports.
- CSV exports.
- Audit logs.

Phase 4 — Smart verification

- Classroom GPS verification.
- Classroom passcodes.
- Risk indicators.
- Optional facial liveness verification after privacy and feasibility review.

16. Acceptance criteria

The lecturer dashboard is ready for its first pilot when:

1. A lecturer can access multiple assigned departments.
2. Each department displays only its authorized courses.
3. A semester supports 15 weeks.
4. A lecturer can create multiple attendance sessions for the same course in one week.
5. Every session has a unique identifier and attendance title.
6. Student attendance cannot be duplicated within the same session.
7. A lecturer can monitor attendance while a session is active.
8. Manual attendance and corrections are auditable.
9. Finalized sessions remain available in historical records.
10. History can be filtered by department, course, semester, week and date.
11. A lecturer can generate a printable PDF report.
12. A lecturer can export authorized attendance records to CSV.
13. Department and lecturer access restrictions are enforced by the backend.
14. The portal works on mobile and desktop.

Final product principle: Department separation, course organization, weekly attendance tracking and permanent historical reporting are foundational capabilities, not optional add-ons. The system must support these from its initial database design.
