/**
 * Analytics (v0.15.0) — how attendance looks across ALL the
 * lecturer's courses, the Nigerian-universities way.
 *
 * The 75% bar is the NUC exam rule, and departments publish the
 * eligible list about two weeks before exams — so the most
 * valuable thing here is the at-risk list (below the bar, and
 * close to it), ready to hand to the head of department. The count
 * is "classes actually held": strikes and cancelled lectures mean
 * a semester rarely holds all 15 weeks, so only finished sessions
 * (Finalized or Archived) count as held — exactly the eligibility
 * rule — and the week grid shows plainly which weeks had a
 * session and which did not.
 *
 * Course first, names second: a course is one summary row
 * (sessions finished, weeks covered, average turnout, how many
 * students are safe / close / below). A 400-student list with no
 * summary is a failure, so the detail comes after the summary.
 *
 * Dirty sessions are shown, never judged: same-device reuse,
 * same-face reuse and headcount mismatch are numbers to review,
 * with the explicit text that a difference is NOT automatic
 * evidence of fraud. Nothing here predicts anything and nothing
 * bans anyone — the lecturer and the head of department decide.
 *
 * Everything here is pure: the caller loads the data through the
 * same assignment-scoped queries (and RLS) as the rest of the
 * portal. The per-student rows ARE the eligibility computation
 * (`computeEligibility`) — same held-session rule, same exact
 * percentage, same bands — so Analytics can never disagree with
 * the Eligibility screen.
 */
import { MAX_WEEK, MIN_WEEK, isFinalized } from './attendance';
import {
  computeEligibility,
  isHeldSession,
  isPresentStatus,
  type EligibilityRow,
} from './eligibility';
import type { AttendanceRecordStatus, SessionStatus } from '@/types/database';

/** One session, as analytics needs it. */
export interface AnalyticsSession {
  id: string;
  course_id: string;
  title: string;
  lecture_date: string;
  week_number: number;
  status: SessionStatus;
  headcount: number | null;
}

/** One attendance record, as analytics needs it. */
export interface AnalyticsRecord {
  session_id: string;
  registration_number: string;
  status: AttendanceRecordStatus;
  device_fingerprint_hash: string | null;
  selfie_hash: string | null;
  face_review: boolean | null;
}

/** One class-list row, as analytics needs it. */
export interface AnalyticsStudent {
  reg_number: string;
  student_name: string | null;
}

/** One week's turnout. */
export interface WeekTurnout {
  week: number;
  /** Finished sessions (Finalized/Archived) that week. */
  heldSessions: number;
  /** Distinct students present in at least one held session that week. */
  presentStudents: number;
  /** All records in held sessions that week, any status. */
  totalSubmissions: number;
}

/**
 * Turnout per week, W1–W15 in order. Only finished sessions
 * count: Draft, Active and Closed sessions do not count yet,
 * because attendance can still change in them.
 */
export function computeWeeklyTurnout(
  sessions: Pick<AnalyticsSession, 'id' | 'week_number' | 'status'>[],
  records: Pick<AnalyticsRecord, 'session_id' | 'registration_number' | 'status'>[],
): WeekTurnout[] {
  const held = sessions.filter(isHeldSession);
  const heldIds = new Set(held.map((s) => s.id));
  const heldById = new Map(held.map((s) => [s.id, s]));
  const heldByWeek = new Map<number, Set<string>>();
  for (const session of held) {
    if (session.week_number < MIN_WEEK || session.week_number > MAX_WEEK) continue;
    const set = heldByWeek.get(session.week_number) ?? new Set<string>();
    set.add(session.id);
    heldByWeek.set(session.week_number, set);
  }

  const presentByWeek = new Map<number, Set<string>>();
  const submissionsByWeek = new Map<number, number>();
  for (const record of records) {
    if (!heldIds.has(record.session_id)) continue;
    const session = heldById.get(record.session_id);
    if (!session) continue;
    if (session.week_number < MIN_WEEK || session.week_number > MAX_WEEK) continue;
    submissionsByWeek.set(
      session.week_number,
      (submissionsByWeek.get(session.week_number) ?? 0) + 1,
    );
    if (!isPresentStatus(record.status)) continue;
    const set = presentByWeek.get(session.week_number) ?? new Set<string>();
    set.add(record.registration_number);
    presentByWeek.set(session.week_number, set);
  }

  const weeks: WeekTurnout[] = [];
  for (let week = MIN_WEEK; week <= MAX_WEEK; week += 1) {
    weeks.push({
      week,
      heldSessions: heldByWeek.get(week)?.size ?? 0,
      presentStudents: presentByWeek.get(week)?.size ?? 0,
      totalSubmissions: submissionsByWeek.get(week) ?? 0,
    });
  }
  return weeks;
}

/** One session's review flags — numbers to review, never a verdict. */
export interface SessionReview {
  sessionId: string;
  title: string;
  lectureDate: string;
  weekNumber: number;
  status: SessionStatus;
  headcount: number | null;
  totalRecords: number;
  /** Records the server flagged: same face, another number. */
  faceFlags: number;
  /** Distinct device hashes used by two or more numbers in this session. */
  reusedDevices: number;
  /** Distinct selfie hashes used by two or more numbers in this session. */
  sameFace: number;
  /**
   * Headcount minus submissions — only when the session is done
   * taking submissions (Closed, Finalized, Archived) and a
   * headcount was recorded. Draft/Active sessions are still
   * taking submissions, so a difference there is expected, not a
   * flag. Null when it does not apply.
   */
  headcountDifference: number | null;
}

/**
 * A session's headcount difference is only meaningful once
 * submissions are done: Closed, Finalized or Archived. Draft and
 * Active sessions are still taking submissions.
 */
export function isReviewableForHeadcount(status: SessionStatus): boolean {
  return status === 'closed' || isFinalized(status);
}

/**
 * The sessions a lecturer should look at: any session with a face
 * flag, a reused device, a reused face, or a headcount difference
 * once submissions are done. Sessions with nothing to review are
 * left out — the list is short on purpose.
 */
export function computeSessionReview(
  sessions: AnalyticsSession[],
  records: AnalyticsRecord[],
): SessionReview[] {
  const recordsBySession = new Map<string, AnalyticsRecord[]>();
  for (const record of records) {
    const list = recordsBySession.get(record.session_id) ?? [];
    list.push(record);
    recordsBySession.set(record.session_id, list);
  }

  const reviews: SessionReview[] = [];
  for (const session of sessions) {
    const sessionRecords = recordsBySession.get(session.id) ?? [];
    if (sessionRecords.length === 0) continue;

    const faceFlags = sessionRecords.filter((r) => r.face_review === true).length;

    // One device hash (or one selfie hash) used by two or more
    // numbers in this session counts once — the hash is the
    // reuse, however many records used it.
    const reusedDevices = countSharedHashes(
      sessionRecords,
      (r) => r.device_fingerprint_hash,
    );
    const sameFace = countSharedHashes(sessionRecords, (r) => r.selfie_hash);

    const headcountDifference =
      isReviewableForHeadcount(session.status) && session.headcount !== null
        ? session.headcount - sessionRecords.length
        : null;

    const worthReviewing =
      faceFlags > 0 ||
      reusedDevices > 0 ||
      sameFace > 0 ||
      (headcountDifference !== null && headcountDifference !== 0);
    if (!worthReviewing) continue;

    reviews.push({
      sessionId: session.id,
      title: session.title,
      lectureDate: session.lecture_date,
      weekNumber: session.week_number,
      status: session.status,
      headcount: session.headcount,
      totalRecords: sessionRecords.length,
      faceFlags,
      reusedDevices,
      sameFace,
      headcountDifference,
    });
  }
  reviews.sort((a, b) => a.lectureDate.localeCompare(b.lectureDate));
  return reviews;
}

/** Distinct non-empty hashes used by two or more numbers. */
function countSharedHashes(
  records: AnalyticsRecord[],
  pick: (record: AnalyticsRecord) => string | null,
): number {
  const numbersByHash = new Map<string, Set<string>>();
  for (const record of records) {
    const hash = pick(record);
    if (hash === null || hash === '') continue;
    const set = numbersByHash.get(hash) ?? new Set<string>();
    set.add(record.registration_number);
    numbersByHash.set(hash, set);
  }
  let shared = 0;
  for (const numbers of numbersByHash.values()) {
    if (numbers.size >= 2) shared += 1;
  }
  return shared;
}

/** One course's analytics, summary first. */
export interface CourseAnalytics {
  courseId: string;
  totalSessions: number;
  heldSessions: number;
  /** Weeks 1–15 with at least one finished session. */
  weeksCovered: number;
  /**
   * Exact average share of the class present per finished
   * session, or null when it cannot be worked out (no finished
   * session, or no class list to measure against).
   */
  averageTurnout: number | null;
  bandCounts: { safe: number; approaching: number; below: number };
  /** The eligibility rows themselves — same rule, same bands. */
  rows: EligibilityRow[];
  weekly: WeekTurnout[];
  reviewSessions: SessionReview[];
}

export interface CourseAnalyticsInput {
  courseId: string;
  sessions: AnalyticsSession[];
  records: AnalyticsRecord[];
  students: AnalyticsStudent[];
  threshold: number;
}

/**
 * One course's analytics. The per-student rows are the eligibility
 * computation itself, so this screen can never disagree with the
 * Eligibility view.
 */
export function computeCourseAnalytics(input: CourseAnalyticsInput): CourseAnalytics {
  const { courseId, sessions, records, students, threshold } = input;
  const heldSessions = sessions.filter(isHeldSession);
  const heldIds = new Set(heldSessions.map((s) => s.id));

  const rows = computeEligibility({
    sessions: sessions.map((s) => ({ id: s.id, week_number: s.week_number, status: s.status })),
    records: records.map((r) => ({
      session_id: r.session_id,
      registration_number: r.registration_number,
      status: r.status,
    })),
    students,
    threshold,
  });

  const bandCounts = { safe: 0, approaching: 0, below: 0 };
  for (const row of rows) {
    if (row.band !== null) bandCounts[row.band] += 1;
  }

  const weeksCovered = new Set(
    heldSessions
      .filter((s) => s.week_number >= MIN_WEEK && s.week_number <= MAX_WEEK)
      .map((s) => s.week_number),
  ).size;

  // Average turnout = present records in finished sessions ÷
  // (finished sessions × class size). One record per number per
  // session is enforced by the database, so counting records is
  // exact. Without a class list there is nothing to measure
  // against, so the answer is null, never a made-up number.
  let averageTurnout: number | null = null;
  if (heldSessions.length > 0 && students.length > 0) {
    let present = 0;
    for (const record of records) {
      if (heldIds.has(record.session_id) && isPresentStatus(record.status)) present += 1;
    }
    averageTurnout = (present / (heldSessions.length * students.length)) * 100;
  }

  return {
    courseId,
    totalSessions: sessions.length,
    heldSessions: heldSessions.length,
    weeksCovered,
    averageTurnout,
    bandCounts,
    rows,
    weekly: computeWeeklyTurnout(sessions, records),
    reviewSessions: computeSessionReview(sessions, records),
  };
}

/** The at-risk rows: below the bar first, then close to it, worst first. */
export function atRiskRows(rows: EligibilityRow[]): EligibilityRow[] {
  return rows
    .filter((row) => row.band === 'below' || row.band === 'approaching')
    .sort((a, b) => {
      if (a.band !== b.band) return a.band === 'below' ? -1 : 1;
      const pa = a.percentage ?? 0;
      const pb = b.percentage ?? 0;
      if (pa !== pb) return pa - pb;
      return a.regNumber.localeCompare(b.regNumber);
    });
}
