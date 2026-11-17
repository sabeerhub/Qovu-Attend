/**
 * Attendance history — filters (pure, v0.14.0).
 *
 * History is the lecturer's own sessions, loaded through the same
 * RLS-scoped query as the session list (see SessionList), so the
 * filters below can only ever narrow what the lecturer is already
 * authorized to see. They never widen it.
 */
import type { AttendanceSession, SessionStatus } from '@/types/database';

/** One history row: a session with its course code + department. */
export interface HistorySessionRow extends AttendanceSession {
  courses: { code: string; department_id: string } | null;
}

/** The columns a history row is read back with. */
export const HISTORY_SESSION_SELECT =
  'id, course_id, lecturer_id, semester_id, lecture_room_id, title, lecture_date, start_time, week_number, headcount, qr_expires_in_seconds, status, created_at, updated_at, anchor_latitude, anchor_longitude, anchor_accuracy_meters, anchor_captured_at, location_radius_meters, courses(code, department_id)';

/** The filters on the History screen. Empty means "all". */
export interface HistoryFilters {
  departmentId: string;
  courseId: string;
  status: SessionStatus | '';
  /** YYYY-MM-DD, inclusive. Empty means no bound. */
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_HISTORY_FILTERS: HistoryFilters = {
  departmentId: '',
  courseId: '',
  status: '',
  dateFrom: '',
  dateTo: '',
};

/** True when at least one filter is set. */
export function hasHistoryFilters(filters: HistoryFilters): boolean {
  return (
    filters.departmentId !== '' ||
    filters.courseId !== '' ||
    filters.status !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== ''
  );
}

/**
 * Narrow a session list to the filters. Dates compare as ISO
 * strings (YYYY-MM-DD), so the range is inclusive on both ends.
 * Order is preserved — the caller loads newest first.
 */
export function filterHistorySessions(
  sessions: HistorySessionRow[],
  filters: HistoryFilters,
): HistorySessionRow[] {
  return sessions.filter((session) => {
    if (filters.departmentId !== '') {
      if (session.courses?.department_id !== filters.departmentId) return false;
    }
    if (filters.courseId !== '') {
      if (session.course_id !== filters.courseId) return false;
    }
    if (filters.status !== '') {
      if (session.status !== filters.status) return false;
    }
    if (filters.dateFrom !== '' && session.lecture_date < filters.dateFrom) return false;
    if (filters.dateTo !== '' && session.lecture_date > filters.dateTo) return false;
    return true;
  });
}
