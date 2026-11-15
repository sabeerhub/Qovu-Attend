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
import { validateLectureDate, weekForDate, type SemesterDates } from './calendar';

export const QR_EXPIRY_OPTIONS = [60, 300, 600, 900] as const;
export type QrExpirySeconds = (typeof QR_EXPIRY_OPTIONS)[number];

export interface SessionFormInput {
  departmentId: string;
  courseId: string;
  title: string;
  lectureDate: string;
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
  weekNumber?: string;
  headcount?: string;
  qrExpiresInSeconds?: string;
}

/**
 * Validate a session form against the course's semester.
 * The chosen week must agree with the week the lecture date falls
 * in — a week/date mismatch is rejected here, before any insert.
 */
export function validateSessionForm(
  input: SessionFormInput,
  semester: SemesterDates | null,
): SessionFormErrors {
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

  if (!semester) {
    if (!errors.lectureDate) {
      errors.lectureDate = 'The selected course has no semester configured yet.';
    }
    return errors;
  }

  const dateCheck = validateLectureDate(semester, input.lectureDate);
  if (!dateCheck.valid) {
    errors.lectureDate = dateCheck.reason;
  } else if (isValidWeekNumber(input.weekNumber)) {
    const derivedWeek = weekForDate(semester, input.lectureDate);
    if (derivedWeek !== input.weekNumber) {
      errors.weekNumber =
        `That date falls in week ${derivedWeek} of this semester, not week ${input.weekNumber}. ` +
        `Change the week or the date so they agree.`;
    }
  }

  return errors;
}

export function hasSessionFormErrors(errors: SessionFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
