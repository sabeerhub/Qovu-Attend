/**
 * Eligibility — the 75% check (pure, tested).
 *
 * For each course, every student gets an attendance percentage:
 * sessions attended divided by sessions actually held.
 *
 * What counts as "held": only a session that is finished and
 * locked — Finalized or Archived (`isFinalized` in
 * ./attendance). Draft, Active and Closed sessions do not count
 * yet, because attendance can still change in them. There is no
 * cancelled session status in this codebase, so there is nothing
 * extra to exclude.
 *
 * What counts as "attended": a record with status `verified` or
 * `manual`. A student added by hand by the lecturer counts as
 * present, the same as a verified one. `pending`, `rejected` and
 * `suspicious` do not count as present.
 *
 * The percentage that decides is the EXACT one, not rounded up:
 * 74.6% is below a 75% bar. The displayed number is rounded to one
 * decimal for reading only; the band is decided from the exact
 * value.
 *
 * Risk bands (they move with the bar when the lecturer changes
 * it): below = under the bar; approaching = from the bar up to 9
 * points above it (so 75–84% when the bar is 75%); safe = 10 or
 * more points above the bar.
 *
 * The week map is per week, not per session: a week shows
 * "attended" when the student was present in at least one locked
 * session that week, "missed" when there were locked sessions that
 * week and the student was present in none, and "no session" when
 * the week had no locked sessions. The attended/held counts stay
 * per session, so a student can be 1 of 2 sessions in a week and
 * the week still shows "attended".
 *
 * Nothing here touches the network or the database: the caller
 * loads the course's sessions, records and class list and passes
 * them in. The percentage is computed, never stored — a stored
 * percentage would go stale the moment a session is finalized.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isFinalized, MAX_WEEK, MIN_WEEK } from './attendance';
import type { AttendanceRecordStatus, SessionStatus } from '@/types/database';

/** The default bar: 75%. */
export const DEFAULT_ELIGIBILITY_THRESHOLD = 75;

/** The bar is a whole number from 0 to 100. */
export function isValidThreshold(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100
  );
}

/** Plain-language error for a bad bar, or null when it is fine. */
export function validateThreshold(value: unknown): string | null {
  if (!isValidThreshold(value)) {
    return 'The bar must be a whole number between 0 and 100.';
  }
  return null;
}

/** One session as the computation needs it. */
export interface EligibilitySession {
  id: string;
  week_number: number;
  status: SessionStatus;
}

/** One attendance record as the computation needs it. */
export interface EligibilityRecord {
  session_id: string;
  registration_number: string;
  status: AttendanceRecordStatus;
}

/** One class-list row as the computation needs it. */
export interface EligibilityStudent {
  reg_number: string;
  student_name: string | null;
}

/** A record counts as present: verified, or added by hand. */
export function isPresentStatus(status: AttendanceRecordStatus): boolean {
  return status === 'verified' || status === 'manual';
}

/** A session counts as held only once it is finished and locked. */
export function isHeldSession(session: EligibilitySession): boolean {
  return isFinalized(session.status);
}

export type EligibilityBand = 'below' | 'approaching' | 'safe';

/**
 * Which band an exact percentage falls in. The exact value
 * decides, never the rounded display value.
 */
export function bandForPercentage(percentage: number, threshold: number): EligibilityBand {
  if (percentage < threshold) return 'below';
  if (percentage < threshold + 10) return 'approaching';
  return 'safe';
}

export type WeekAttendance = 'attended' | 'missed' | 'no-session';

export interface EligibilityRow {
  /** Registration number, as stored (normalized trim + upper). */
  regNumber: string;
  /** Name from the class list, or null when the student is not on it. */
  studentName: string | null;
  attended: number;
  held: number;
  /** Exact percentage, or null when no session is held yet. */
  percentage: number | null;
  /** Null when no session is held yet (nothing to judge against). */
  band: EligibilityBand | null;
  /** Week 1–15, in order. */
  weeks: WeekAttendance[];
}

export interface EligibilityInput {
  sessions: EligibilitySession[];
  records: EligibilityRecord[];
  /** The course's class list (may be empty). */
  students: EligibilityStudent[];
  threshold: number;
}

/**
 * One row per student: every student on the class list, plus any
 * registration number that has records but is not on the list
 * (courses without a list). A class-list student with no records
 * shows 0%. Rows are sorted by registration number.
 */
export function computeEligibility(input: EligibilityInput): EligibilityRow[] {
  const { sessions, records, students, threshold } = input;
  const heldSessions = sessions.filter(isHeldSession);
  const heldIds = new Set(heldSessions.map((s) => s.id));
  const held = heldSessions.length;

  // Locked sessions per week (week 1–15 only).
  const sessionsByWeek = new Map<number, EligibilitySession[]>();
  for (const session of heldSessions) {
    if (session.week_number < MIN_WEEK || session.week_number > MAX_WEEK) continue;
    const list = sessionsByWeek.get(session.week_number) ?? [];
    list.push(session);
    sessionsByWeek.set(session.week_number, list);
  }

  // Present (verified/manual) session ids per registration number,
  // counting only records in held sessions. One record per session
  // per number is enforced by the database, so a Set is exact.
  const presentByReg = new Map<string, Set<string>>();
  for (const record of records) {
    if (!heldIds.has(record.session_id)) continue;
    if (!isPresentStatus(record.status)) continue;
    const set = presentByReg.get(record.registration_number) ?? new Set<string>();
    set.add(record.session_id);
    presentByReg.set(record.registration_number, set);
  }

  // Every student: the class list first, then any number with
  // records that is not on the list.
  const byReg = new Map<string, { name: string | null }>();
  for (const student of students) {
    byReg.set(student.reg_number, { name: student.student_name });
  }
  for (const regNumber of presentByReg.keys()) {
    if (!byReg.has(regNumber)) byReg.set(regNumber, { name: null });
  }
  // Numbers with only non-present records (pending, rejected,
  // suspicious) in held sessions still get a row: they attended
  // nothing, which is exactly what 0% means.
  for (const record of records) {
    if (!heldIds.has(record.session_id)) continue;
    if (!byReg.has(record.registration_number)) {
      byReg.set(record.registration_number, { name: null });
    }
  }

  const rows: EligibilityRow[] = [];
  for (const [regNumber, { name }] of byReg) {
    const present = presentByReg.get(regNumber) ?? new Set<string>();
    const attended = present.size;
    const percentage = held > 0 ? (attended / held) * 100 : null;
    const weeks: WeekAttendance[] = [];
    for (let week = MIN_WEEK; week <= MAX_WEEK; week += 1) {
      const weekSessions = sessionsByWeek.get(week);
      if (!weekSessions || weekSessions.length === 0) {
        weeks.push('no-session');
      } else if (weekSessions.some((s) => present.has(s.id))) {
        weeks.push('attended');
      } else {
        weeks.push('missed');
      }
    }
    rows.push({
      regNumber,
      studentName: name,
      attended,
      held,
      percentage,
      band: percentage === null ? null : bandForPercentage(percentage, threshold),
      weeks,
    });
  }
  rows.sort((a, b) => a.regNumber.localeCompare(b.regNumber));
  return rows;
}

/**
 * Map a server error to a plain-language message. The RPC prefixes
 * its errors with a stable code ("course_not_assigned: ..."); the
 * human part after the colon is used when the code is unknown.
 */
export function mapSetThresholdError(message: string): string {
  if (message.includes('course_not_assigned')) {
    return 'You are not assigned to this course.';
  }
  if (message.includes('course_not_found')) {
    return 'This course does not exist any more.';
  }
  if (message.includes('lecturer_profile_not_found')) {
    return 'Your account has no lecturer profile yet. Ask your university administrator to create one for your account.';
  }
  if (message.includes('threshold_invalid')) {
    return 'The bar must be a whole number between 0 and 100.';
  }
  const colon = message.indexOf(':');
  if (colon > 0) {
    const detail = message.slice(colon + 1).trim();
    if (detail.length > 0) return detail;
  }
  return 'The bar could not be saved. Try again.';
}

/**
 * Change a course's bar through the server-side RPC. Returns the
 * saved bar on success, or a plain-language error string on
 * failure. `client` is the configured Supabase client. The RPC
 * re-validates the range and the caller's assignment server-side;
 * the client-side check in `validateThreshold` is field-level UX
 * only.
 */
export async function setEligibilityThreshold(
  client: Pick<SupabaseClient, 'rpc'>,
  courseId: string,
  threshold: number,
): Promise<{ threshold: number } | { error: string }> {
  const { data, error } = await client.rpc('set_eligibility_threshold', {
    p_course_id: courseId,
    p_threshold: threshold,
  });
  if (error) {
    return { error: mapSetThresholdError(error.message) };
  }
  if (typeof data !== 'number') {
    return { error: 'The bar could not be saved. Try again.' };
  }
  return { threshold: data };
}
