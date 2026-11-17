/**
 * Exports — PDF (printable report) + CSV (v0.14.0).
 *
 * Everything here is pure: shape the data, build the CSV text,
 * build the report data the print view renders. Nothing here
 * touches the network or the database. The caller loads the data
 * through the same assignment-scoped queries (and RLS) as the rest
 * of the portal, so an export can only ever contain the signed-in
 * lecturer's own authorized records — there is no server-side
 * export function and none is needed.
 *
 * CSV columns follow the contract in docs/API_CONTRACTS.md, in
 * order: registration number, student name, department, course
 * code, academic session, semester, week, attendance title,
 * lecture date, attendance status, verification method, submission
 * timestamp, manual attendance reason. Values are escaped per
 * RFC 4180 and formula injection is neutralized (see ./csv), and
 * the file starts with a UTF-8 BOM so Excel opens it as UTF-8.
 *
 * The PDF is not a file: it is a print view (see
 * features/reports/PrintReport) rendered with A4 `@page` CSS and
 * printed/saved as PDF from the browser. No PDF library.
 *
 * The header is honest: there is no university name or logo
 * configured anywhere in Qovu, so the report header uses the Qovu
 * brand plus the real department, course, session, date and
 * lecturer name. A university name/logo setting is still an open
 * question for the owner — nothing is invented here.
 */
import { toCsvWithBom } from './csv';
import { computeEligibility, isPresentStatus, type EligibilityRow } from './eligibility';
import { isFinalized } from './attendance';
import { summarizeRecords, type RecordSummary } from './submission';
import type {
  AttendanceRecordStatus,
  AttendanceSession,
  SessionStatus,
} from '@/types/database';

/** Context every export row and report header is stamped with. */
export interface ExportContext {
  departmentName: string;
  courseCode: string;
  courseTitle: string;
  academicSessionName: string;
  semesterName: string;
}

/** Session context adds the lecturer and the room (for the PDF). */
export interface SessionExportContext extends ExportContext {
  lecturerName: string;
  roomName: string | null;
}

/** One attendance record, as the exports need it. */
export interface ExportRecord {
  registration_number: string;
  student_name: string | null;
  status: AttendanceRecordStatus;
  verification_method: string | null;
  submitted_at: string;
  manual_reason: string | null;
}

/** One session, as the course export needs it. */
export interface ExportSession {
  id: string;
  title: string;
  lecture_date: string;
  week_number: number;
  status: SessionStatus;
  headcount: number | null;
}

/** CSV column headers, in the contract order. */
export const EXPORT_CSV_HEADERS = [
  'Registration number',
  'Student name',
  'Department',
  'Course code',
  'Academic session',
  'Semester',
  'Week',
  'Attendance title',
  'Lecture date',
  'Attendance status',
  'Verification method',
  'Submission timestamp',
  'Manual attendance reason',
] as const;

/** Plain words for a status word (record or session status). */
export function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Plain words for how a student was verified. */
export function methodLabel(method: string | null): string {
  if (method === 'qr') return 'QR code';
  if (method === 'passcode') return 'Passcode';
  if (method === 'manual') return 'Manual';
  return '—';
}

/** Plain words for an eligibility band. */
export function bandLabel(band: EligibilityRow['band']): string {
  if (band === 'below') return 'Below the bar';
  if (band === 'approaching') return 'Close to the bar';
  if (band === 'safe') return 'Safe';
  return '—';
}

/**
 * The percentage as shown: one decimal, or a dash when no session
 * is held yet. The exact, unrounded value decides the band — this
 * is display only.
 */
export function formatPercentage(percentage: number | null): string {
  if (percentage === null) return '—';
  return `${percentage.toFixed(1)}%`;
}

/** One CSV row for a record in a session, in the contract order. */
export function recordToCsvRow(
  context: ExportContext,
  session: Pick<ExportSession, 'title' | 'lecture_date' | 'week_number'>,
  record: ExportRecord,
): Array<string | number | null | undefined> {
  return [
    record.registration_number,
    record.student_name,
    context.departmentName,
    context.courseCode,
    context.academicSessionName,
    context.semesterName,
    session.week_number,
    session.title,
    session.lecture_date,
    statusLabel(record.status),
    methodLabel(record.verification_method),
    record.submitted_at,
    record.manual_reason,
  ];
}

/**
 * One session's attendance as CSV. Rows are in submission order
 * (the order the monitor shows). A session with no records still
 * downloads — headers only, never an error.
 */
export function sessionRecordsToCsv(
  context: ExportContext,
  session: Pick<ExportSession, 'title' | 'lecture_date' | 'week_number'>,
  records: ExportRecord[],
): string {
  const rows = [...records]
    .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at))
    .map((record) => recordToCsvRow(context, session, record));
  return toCsvWithBom([...EXPORT_CSV_HEADERS], rows);
}

/**
 * A whole course as CSV — session-level detail, one row per record
 * per session, sessions in date order. The PDF is the printable
 * summary; this file keeps the detail.
 */
export function courseRecordsToCsv(
  context: ExportContext,
  sessions: ExportSession[],
  records: Array<ExportRecord & { session_id: string }>,
): string {
  const orderedSessions = [...sessions].sort(
    (a, b) =>
      a.lecture_date.localeCompare(b.lecture_date) || a.week_number - b.week_number,
  );
  const sessionById = new Map(orderedSessions.map((s) => [s.id, s]));
  const recordsBySession = new Map<string, ExportRecord[]>();
  for (const record of records) {
    // A record for a session that is not in this course's list
    // (it cannot happen through the UI queries, but the export
    // never invents a session for it) is left out.
    if (!sessionById.has(record.session_id)) continue;
    const list = recordsBySession.get(record.session_id) ?? [];
    list.push(record);
    recordsBySession.set(record.session_id, list);
  }
  const rows: Array<Array<string | number | null | undefined>> = [];
  for (const session of orderedSessions) {
    const sessionRecords = [...(recordsBySession.get(session.id) ?? [])].sort((a, b) =>
      a.submitted_at.localeCompare(b.submitted_at),
    );
    for (const record of sessionRecords) {
      rows.push(recordToCsvRow(context, session, record));
    }
  }
  return toCsvWithBom([...EXPORT_CSV_HEADERS], rows);
}

/** File-safe slug: lowercase, anything else becomes a dash. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Today's date as YYYY-MM-DD, for filenames. */
export function todayIso(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function sessionCsvFilename(
  courseCode: string,
  session: Pick<ExportSession, 'week_number' | 'lecture_date'>,
  date: Date = new Date(),
): string {
  return `qovu-${slugify(courseCode)}-week-${session.week_number}-${session.lecture_date}-attendance-${todayIso(date)}.csv`;
}

export function courseCsvFilename(courseCode: string, date: Date = new Date()): string {
  return `qovu-${slugify(courseCode)}-attendance-${todayIso(date)}.csv`;
}

/** Download a text file in the browser (the StudentImport pattern). */
export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** One session's report, as the print view renders it. */
export interface SessionReportData {
  kind: 'session';
  generatedAt: string;
  context: SessionExportContext;
  session: {
    title: string;
    lecture_date: string;
    start_time: string | null;
    week_number: number;
    status: SessionStatus;
    headcount: number | null;
  };
  summary: RecordSummary;
  /** Headcount minus submissions, or null when no headcount. */
  difference: number | null;
  rows: ExportRecord[];
}

/** Build one session's report data (pure). */
export function buildSessionReport(
  context: SessionExportContext,
  session: AttendanceSession,
  records: ExportRecord[],
  generatedAt: Date = new Date(),
): SessionReportData {
  const ordered = [...records].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  return {
    kind: 'session',
    generatedAt: generatedAt.toISOString(),
    context,
    session: {
      title: session.title,
      lecture_date: session.lecture_date,
      start_time: session.start_time,
      week_number: session.week_number,
      status: session.status,
      headcount: session.headcount,
    },
    summary: summarizeRecords(records),
    difference: session.headcount === null ? null : session.headcount - records.length,
    rows: ordered,
  };
}

/** One course's report, as the print view renders it. */
export interface CourseReportData {
  kind: 'course';
  generatedAt: string;
  course: {
    code: string;
    title: string;
    departmentName: string;
    semesterName: string;
    academicSessionName: string;
    lecturerName: string;
    threshold: number;
  };
  totalSessions: number;
  heldSessions: number;
  sessions: Array<{
    id: string;
    title: string;
    lecture_date: string;
    week_number: number;
    status: SessionStatus;
    headcount: number | null;
    present: number;
  }>;
  rows: EligibilityRow[];
}

/**
 * Build one course's report data (pure). The per-student rows are
 * the eligibility computation itself — same held-session rule, same
 * exact percentage, same bands — so the PDF can never disagree
 * with the Eligibility screen.
 */
export function buildCourseReport(
  course: {
    code: string;
    title: string;
    departmentName: string;
    semesterName: string;
    academicSessionName: string;
    lecturerName: string;
    threshold: number;
  },
  sessions: ExportSession[],
  records: Array<ExportRecord & { session_id: string }>,
  students: Array<{ reg_number: string; student_name: string | null }>,
  generatedAt: Date = new Date(),
): CourseReportData {
  const orderedSessions = [...sessions].sort(
    (a, b) =>
      a.lecture_date.localeCompare(b.lecture_date) || a.week_number - b.week_number,
  );
  const presentBySession = new Map<string, number>();
  for (const record of records) {
    if (!isPresentStatus(record.status)) continue;
    presentBySession.set(record.session_id, (presentBySession.get(record.session_id) ?? 0) + 1);
  }
  const rows = computeEligibility({
    sessions: sessions.map((s) => ({ id: s.id, week_number: s.week_number, status: s.status })),
    records: records.map((r) => ({
      session_id: r.session_id,
      registration_number: r.registration_number,
      status: r.status,
    })),
    students,
    threshold: course.threshold,
  });
  return {
    kind: 'course',
    generatedAt: generatedAt.toISOString(),
    course,
    totalSessions: sessions.length,
    heldSessions: sessions.filter((s) => isFinalized(s.status)).length,
    sessions: orderedSessions.map((s) => ({
      id: s.id,
      title: s.title,
      lecture_date: s.lecture_date,
      week_number: s.week_number,
      status: s.status,
      headcount: s.headcount,
      present: presentBySession.get(s.id) ?? 0,
    })),
    rows,
  };
}

export type ReportData = SessionReportData | CourseReportData;
