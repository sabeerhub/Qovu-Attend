/**
 * Session creation validation (pure, tested).
 *
 * Runs client-side before any network call. The database CHECK
 * (week 1–15, headcount >= 0) and RLS (assignment + lecturer_id)
 * are the server-side backstop; this is the field-level UX layer.
 * Lecturer id, timestamp and status='draft' are set by the system
 * and are never part of this payload.
 */
import { isValidWeekNumber } from './attendance';
import { weekForDate, type SemesterDates } from './calendar';

export const QR_EXPIRY_OPTIONS = [60, 300, 600, 900] as const;
export type QrExpirySeconds = (typeof QR_EXPIRY_OPTIONS)[number];

export interface SessionFormInput {
  departmentId: string;
  courseId: string;
  title: string;
  lectureDate: string;
  /** Lecture start time, 24-hour HH:MM, set by the lecturer. */
  startTime: string;
  weekNumber: number;
  headcount: number | null;
  qrExpiresInSeconds: number;
  lectureRoomId: string | null;
}

export interface SessionFormErrors {
  departmentId?: string;
  courseId?: string;
  title?: string;
  lectureDate?: string;
  startTime?: string;
  weekNumber?: string;
  headcount?: string;
  qrExpiresInSeconds?: string;
}

/** True when the value is a real calendar day in YYYY-MM-DD form. */
function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible dates such as 2026-02-30 (Date.UTC rolls over).
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** True when the value is a 24-hour clock time in HH:MM form. */
export function isValidStartTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * Week auto-suggest for the session form. When the picked lecture
 * date falls inside the course semester, the week it falls in is
 * suggested (the form sets the week select to it, still editable);
 * when the date is outside the semester — or there is no semester
 * or date yet — there is no suggestion and the lecturer's chosen
 * week stands. Never a rejection.
 */
export function suggestedWeekForLectureDate(
  semester: SemesterDates | null,
  lectureDate: string,
): number | null {
  if (!semester || !lectureDate) return null;
  return weekForDate(semester, lectureDate);
}

/**
 * Validate a session form.
 *
 * The lecturer sets the lecture date, start time and week freely
 * (product-owner decision 2026-11-16, overriding spec §6): a date
 * outside the semester dates is allowed, and the chosen week need
 * not match the week the date falls in. The semester is therefore
 * not consulted here at all — only that a date and a start time
 * were supplied and are well-formed, plus the standing field rules.
 */
export function validateSessionForm(input: SessionFormInput): SessionFormErrors {
  const errors: SessionFormErrors = {};

  if (!input.departmentId) {
    errors.departmentId = 'Choose a department from your assignments.';
  }
  if (!input.courseId) {
    errors.courseId = 'Choose a course.';
  }
  if (input.title.trim().length === 0) {
    errors.title = 'Enter an attendance title / lecture topic.';
  }

  if (!input.lectureDate) {
    errors.lectureDate = 'Choose a lecture date.';
  } else if (!isValidCalendarDate(input.lectureDate)) {
    errors.lectureDate = 'Lecture date must be a valid date (YYYY-MM-DD).';
  }

  if (!input.startTime) {
    errors.startTime = 'Choose a lecture start time.';
  } else if (!isValidStartTime(input.startTime)) {
    errors.startTime = 'Lecture start time must be a valid 24-hour time (HH:MM).';
  }

  if (!isValidWeekNumber(input.weekNumber)) {
    errors.weekNumber = 'Week number must be between 1 and 15.';
  }

  if (input.headcount !== null) {
    if (!Number.isInteger(input.headcount) || input.headcount < 0) {
      errors.headcount = 'Headcount must be a whole number of 0 or more.';
    }
  }

  if (!(QR_EXPIRY_OPTIONS as readonly number[]).includes(input.qrExpiresInSeconds)) {
    errors.qrExpiresInSeconds = 'QR expiry must be 60, 300, 600 or 900 seconds.';
  }

  return errors;
}

export function hasSessionFormErrors(errors: SessionFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
