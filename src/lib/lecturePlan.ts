/**
 * My Lecture Plan helpers (pure, tested) + RPC call.
 *
 * A plan entry is one planned lecture in the lecturer's own weekly
 * timetable: a course, a weekday (Monday–Saturday), a start time,
 * an optional end time and an optional free-text room.
 *
 * Runs client-side before any network call, for field-level UX.
 * The server-side backstop is the `create_lecture_plan` RPC
 * (supabase/migrations/20261117030000_lecture_plans.sql): it
 * re-validates everything, resolves the lecturer profile from the
 * auth session, and refuses any course the caller is not assigned
 * to. The client never inserts into `lecture_plans` directly.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidStartTime } from './sessionForm';
import { weekForDate } from './calendar';
import type { AssignedCourse } from '@/hooks/useAssignments';
import type { LecturePlan } from '@/types/database';

/** Weekday labels, 1 = Monday .. 6 = Saturday. */
export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const DAY_SHORT_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** True when the value is a teaching weekday, 1 (Monday) to 6 (Saturday). */
export function isValidDayOfWeek(day: unknown): day is number {
  return typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 6;
}

export function dayName(day: number): string {
  return isValidDayOfWeek(day) ? DAY_NAMES[day - 1] : '';
}

export function dayShortName(day: number): string {
  return isValidDayOfWeek(day) ? DAY_SHORT_NAMES[day - 1] : '';
}

/**
 * Postgres `time` comes back as "08:00:00"; inputs and display use
 * "HH:MM". Returns '' for anything that is not a valid time.
 */
export function toHHMM(value: string): string {
  const match = /^([01]\d|2[0-3]):[0-5]\d/.exec(value.trim());
  return match ? match[0] : '';
}

export interface LecturePlanFormInput {
  courseId: string;
  dayOfWeek: number | null;
  startTime: string;
  /** '' means no end time. */
  endTime: string;
  room: string;
}

export interface LecturePlanFormErrors {
  courseId?: string;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
}

export function validateLecturePlanForm(input: LecturePlanFormInput): LecturePlanFormErrors {
  const errors: LecturePlanFormErrors = {};

  if (!input.courseId) {
    errors.courseId = 'Choose a course.';
  }
  if (input.dayOfWeek === null || !isValidDayOfWeek(input.dayOfWeek)) {
    errors.dayOfWeek = 'Choose a day from Monday to Saturday.';
  }
  if (!input.startTime) {
    errors.startTime = 'Choose a lecture start time.';
  } else if (!isValidStartTime(input.startTime)) {
    errors.startTime = 'Lecture start time must be a valid 24-hour time (HH:MM).';
  }
  if (input.endTime !== '') {
    if (!isValidStartTime(input.endTime)) {
      errors.endTime = 'End time must be a valid 24-hour time (HH:MM).';
    } else if (
      isValidStartTime(input.startTime) &&
      input.endTime <= input.startTime
    ) {
      errors.endTime = 'The end time must be after the start time.';
    }
  }
  if (input.room.trim().length > 80) {
    errors.room = 'The room name must be 80 characters or fewer.';
  }

  return errors;
}

export function hasLecturePlanFormErrors(errors: LecturePlanFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Format a local Date as YYYY-MM-DD. */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * The next calendar date for a weekday (1 = Monday .. 6 =
 * Saturday), counting from `from`. Today when the weekday is today;
 * never a past date. Uses local dates, like the lecturer's own week:
 * from a Sunday, Monday is tomorrow; from a Tuesday, next Monday is
 * six days away.
 */
export function nextOccurrence(dayOfWeek: number, from: Date): string {
  const current = from.getDay(); // 0 = Sunday .. 6 = Saturday
  const target = dayOfWeek; // 1..6 matches JS Monday..Saturday
  const diff = (target - current + 7) % 7;
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + diff);
  return formatLocalDate(date);
}

/** A plan row with the course it is shown under. */
export interface LecturePlanRow extends LecturePlan {
  course: {
    id: string;
    code: string;
    title: string;
    level: number;
    departmentName: string;
  } | null;
}

/**
 * Group plan rows by weekday (Monday first), entries inside a day
 * sorted by start time. Days with no lectures are left out.
 */
export function groupPlansByDay(
  plans: LecturePlanRow[],
): Array<{ day: number; entries: LecturePlanRow[] }> {
  const byDay = new Map<number, LecturePlanRow[]>();
  for (const plan of plans) {
    const list = byDay.get(plan.day_of_week) ?? [];
    list.push(plan);
    byDay.set(plan.day_of_week, list);
  }
  return [1, 2, 3, 4, 5, 6]
    .filter((day) => byDay.has(day))
    .map((day) => ({
      day,
      entries: (byDay.get(day) ?? [])
        .slice()
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }));
}

/** The fields a draft session is created with, from a plan entry. */
export interface PlanSessionInput {
  courseId: string;
  semesterId: string;
  lectureRoomId: null;
  title: string;
  lectureDate: string;
  startTime: string;
  weekNumber: number;
  headcount: null;
  qrExpiresInSeconds: number;
}

/**
 * Build the draft-session input for a plan entry. The lecture date
 * is the next occurrence of the entry's weekday (today when it is
 * today — never a past date); the start time comes from the plan;
 * the week is suggested from the course semester when the date falls
 * inside it, otherwise 1; the title is the course title. The
 * lecturer reviews everything in the session workspace before
 * activating — the plan only prefills, it never decides.
 */
export function sessionInputForPlanEntry(
  entry: LecturePlan,
  course: AssignedCourse,
  today: Date,
): PlanSessionInput {
  const lectureDate = nextOccurrence(entry.day_of_week, today);
  const week = course.semester ? weekForDate(course.semester, lectureDate) : null;
  return {
    courseId: course.id,
    semesterId: course.semester_id,
    lectureRoomId: null,
    title: course.title,
    lectureDate,
    startTime: toHHMM(entry.start_time),
    weekNumber: week ?? 1,
    headcount: null,
    qrExpiresInSeconds: 300,
  };
}

/**
 * Map a server error to a plain-language message. The RPC prefixes
 * its errors with a stable code ("lecture_plan_duplicate: ..."); the
 * human part after the colon is used when the code is unknown.
 */
export function mapCreateLecturePlanError(message: string): string {
  if (message.includes('lecture_plan_duplicate')) {
    return 'This lecture is already in your plan for this day and time.';
  }
  if (message.includes('course_not_assigned')) {
    return 'You are not assigned to this course. Choose one of your courses.';
  }
  if (message.includes('course_not_found')) {
    return 'The selected course does not exist. Choose another course.';
  }
  if (message.includes('lecturer_profile_not_found')) {
    return 'Your account has no lecturer profile yet. Ask your university administrator to create one for your account.';
  }
  if (message.includes('day_of_week_invalid')) {
    return 'Choose a day from Monday to Saturday.';
  }
  if (message.includes('end_time_invalid')) {
    return 'The end time must be after the start time.';
  }
  if (message.includes('start_time_required')) {
    return 'Choose a lecture start time.';
  }
  if (message.includes('room_too_long')) {
    return 'The room name must be 80 characters or fewer.';
  }
  const colon = message.indexOf(':');
  if (colon > 0) {
    const detail = message.slice(colon + 1).trim();
    if (detail.length > 0) return detail;
  }
  return 'The lecture could not be added to your plan. Try again.';
}

/**
 * Create a plan entry through the server-side RPC. Returns the
 * created entry on success, or a plain-language error string on
 * failure. `client` is the configured Supabase client.
 */
export async function createLecturePlan(
  client: Pick<SupabaseClient, 'rpc'>,
  input: LecturePlanFormInput,
): Promise<{ plan: LecturePlan } | { error: string }> {
  const { data, error } = await client.rpc('create_lecture_plan', {
    p_course_id: input.courseId,
    p_day_of_week: input.dayOfWeek,
    p_start_time: input.startTime,
    p_end_time: input.endTime === '' ? null : input.endTime,
    p_room: input.room.trim() === '' ? null : input.room.trim(),
  });
  if (error) {
    return { error: mapCreateLecturePlanError(error.message) };
  }
  if (!data) {
    return { error: 'The lecture could not be added to your plan. Try again.' };
  }
  return { plan: data as LecturePlan };
}
