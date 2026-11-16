/**
 * Academic calendar helpers (pure, tested).
 *
 * A semester has exactly 15 teaching weeks (spec §6,
 * docs/ATTENDANCE_RULES.md). Week 1 is the first 7 days starting on
 * the semester start_date; week N covers days 7*(N-1) .. 7*N-1 after
 * the start date. A date that falls outside the semester dates, or
 * beyond week 15, has no week number.
 *
 * Dates are parsed as UTC calendar days so the result does not depend
 * on the viewer's timezone.
 */

export interface SemesterDates {
  start_date: string;
  end_date: string;
}

const MS_PER_DAY = 86_400_000;

function parseDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible dates such as 2026-02-30 (Date.UTC rolls over).
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * The teaching week (1–15) a date falls in for a semester, or null
 * when the date is outside the semester dates or beyond week 15.
 */
export function weekForDate(semester: SemesterDates, date: string): number | null {
  const start = parseDay(semester.start_date);
  const end = parseDay(semester.end_date);
  const day = parseDay(date);
  if (!start || !end || !day) return null;
  if (day < start || day > end) return null;
  const week = Math.floor(daysBetween(start, day) / 7) + 1;
  if (week < 1 || week > 15) return null;
  return week;
}

/** True when the date falls inside the semester's start/end dates. */
export function isDateInSemester(semester: SemesterDates, date: string): boolean {
  const start = parseDay(semester.start_date);
  const end = parseDay(semester.end_date);
  const day = parseDay(date);
  if (!start || !end || !day) return false;
  return day >= start && day <= end;
}

export type LectureDateValidation =
  | { valid: true; week: number }
  | { valid: false; reason: string };

/**
 * Validate a lecture date against its semester. A date must fall
 * inside the semester and inside one of the 15 teaching weeks.
 *
 * Pure utility, kept for the academic calendar. Since v0.4.1 it is
 * NOT used by session creation: the lecturer sets the lecture date,
 * start time and week freely, so an out-of-semester date is allowed
 * there (product-owner decision 2026-11-16, overriding spec §6).
 */
export function validateLectureDate(
  semester: SemesterDates,
  date: string,
): LectureDateValidation {
  if (!date) return { valid: false, reason: 'Choose a lecture date.' };
  if (!parseDay(date)) {
    return { valid: false, reason: 'Lecture date must be a valid date (YYYY-MM-DD).' };
  }
  if (!isDateInSemester(semester, date)) {
    return {
      valid: false,
      reason: 'Lecture date is outside this semester (check the semester start and end dates).',
    };
  }
  const week = weekForDate(semester, date);
  if (week === null) {
    return {
      valid: false,
      reason: 'Lecture date falls outside the 15 teaching weeks of this semester.',
    };
  }
  return { valid: true, week };
}

/** The date range (inclusive, YYYY-MM-DD) covered by a week number. */
export function weekDateRange(
  semester: SemesterDates,
  week: number,
): { start: string; end: string } | null {
  const start = parseDay(semester.start_date);
  const end = parseDay(semester.end_date);
  if (!start || !end || week < 1 || week > 15) return null;
  const weekStart = new Date(start.getTime() + (week - 1) * 7 * MS_PER_DAY);
  const weekEnd = new Date(Math.min(weekStart.getTime() + 6 * MS_PER_DAY, end.getTime()));
  const format = (d: Date): string => d.toISOString().slice(0, 10);
  return { start: format(weekStart), end: format(weekEnd) };
}
