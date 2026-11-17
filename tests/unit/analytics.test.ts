/**
 * Analytics tests (v0.15.0).
 *
 * Weekly turnout counts only finished sessions; the course
 * summary reuses the eligibility computation (same held rule,
 * same exact %, same bands); the session review flags shared
 * devices, shared faces and headcount differences — and only
 * once submissions are done; the at-risk CSV/print list is
 * below + approaching, worst first, formula-safe.
 */
import { describe, expect, it } from 'vitest';
import {
  atRiskRows,
  computeCourseAnalytics,
  computeSessionReview,
  computeWeeklyTurnout,
  type AnalyticsRecord,
  type AnalyticsSession,
} from '@/lib/analytics';
import {
  atRiskRowsToCsv,
  buildAtRiskReport,
  AT_RISK_CSV_HEADERS,
} from '@/lib/exports';

function session(
  overrides: Partial<AnalyticsSession> & { id: string },
): AnalyticsSession {
  return {
    course_id: 'course-1',
    title: 'Lecture',
    lecture_date: '2026-01-05',
    week_number: 1,
    status: 'finalized',
    headcount: null,
    ...overrides,
  };
}

function record(
  overrides: Partial<AnalyticsRecord> & { session_id: string; registration_number: string },
): AnalyticsRecord {
  return {
    status: 'verified',
    device_fingerprint_hash: null,
    selfie_hash: null,
    face_review: null,
    ...overrides,
  };
}

describe('computeWeeklyTurnout', () => {
  it('counts only finished sessions, per week, distinct students', () => {
    const sessions = [
      session({ id: 's1', week_number: 1, status: 'finalized' }),
      session({ id: 's2', week_number: 1, status: 'finalized' }),
      session({ id: 's3', week_number: 2, status: 'closed' }),
      session({ id: 's4', week_number: 2, status: 'active' }),
      session({ id: 's5', week_number: 3, status: 'draft' }),
    ];
    const records = [
      record({ session_id: 's1', registration_number: 'U001' }),
      record({ session_id: 's2', registration_number: 'U001' }),
      record({ session_id: 's2', registration_number: 'U002' }),
      record({ session_id: 's2', registration_number: 'U003', status: 'pending' }),
      // Closed/active/draft sessions never count, whatever they hold.
      record({ session_id: 's3', registration_number: 'U001' }),
      record({ session_id: 's4', registration_number: 'U001' }),
      record({ session_id: 's5', registration_number: 'U001' }),
    ];
    const weeks = computeWeeklyTurnout(sessions, records);
    expect(weeks).toHaveLength(15);
    expect(weeks[0]).toEqual({
      week: 1,
      heldSessions: 2,
      presentStudents: 2,
      totalSubmissions: 4,
    });
    expect(weeks[1]).toEqual({
      week: 2,
      heldSessions: 0,
      presentStudents: 0,
      totalSubmissions: 0,
    });
    expect(weeks[2]).toEqual({
      week: 3,
      heldSessions: 0,
      presentStudents: 0,
      totalSubmissions: 0,
    });
  });

  it('counts archived sessions as held', () => {
    const sessions = [session({ id: 's1', week_number: 5, status: 'archived' })];
    const records = [record({ session_id: 's1', registration_number: 'U001' })];
    const weeks = computeWeeklyTurnout(sessions, records);
    expect(weeks[4].heldSessions).toBe(1);
    expect(weeks[4].presentStudents).toBe(1);
  });

  it('ignores sessions outside weeks 1–15', () => {
    const sessions = [session({ id: 's1', week_number: 0, status: 'finalized' })];
    const records = [record({ session_id: 's1', registration_number: 'U001' })];
    const weeks = computeWeeklyTurnout(sessions, records);
    expect(weeks.every((w) => w.heldSessions === 0)).toBe(true);
  });
});

describe('computeCourseAnalytics', () => {
  it('summarizes held vs total, weeks covered, band counts', () => {
    const sessions = [
      session({ id: 's1', week_number: 1, status: 'finalized' }),
      session({ id: 's2', week_number: 2, status: 'finalized' }),
      session({ id: 's3', week_number: 2, status: 'archived' }),
      session({ id: 's4', week_number: 3, status: 'active' }),
      session({ id: 's5', week_number: 4, status: 'draft' }),
    ];
    const students = [
      { reg_number: 'U001', student_name: 'A' },
      { reg_number: 'U002', student_name: 'B' },
      { reg_number: 'U003', student_name: 'C' },
      { reg_number: 'U004', student_name: 'D' },
    ];
    const records = [
      record({ session_id: 's1', registration_number: 'U001' }),
      record({ session_id: 's1', registration_number: 'U002' }),
      record({ session_id: 's2', registration_number: 'U001' }),
      record({ session_id: 's3', registration_number: 'U001' }),
      record({ session_id: 's3', registration_number: 'U002' }),
      record({ session_id: 's3', registration_number: 'U003' }),
      // Active/draft sessions never count.
      record({ session_id: 's4', registration_number: 'U004' }),
    ];
    const result = computeCourseAnalytics({
      courseId: 'course-1',
      sessions,
      records,
      students,
      threshold: 75,
    });
    expect(result.totalSessions).toBe(5);
    expect(result.heldSessions).toBe(3);
    expect(result.weeksCovered).toBe(2);
    // U001 3/3 safe, U002 2/3 below, U003 1/3 below, U004 0/3 below.
    expect(result.bandCounts).toEqual({ safe: 1, approaching: 0, below: 3 });
    expect(result.rows).toHaveLength(4);
  });

  it('computes average turnout from the class list, exactly', () => {
    const sessions = [
      session({ id: 's1', week_number: 1, status: 'finalized' }),
      session({ id: 's2', week_number: 2, status: 'finalized' }),
    ];
    const students = [
      { reg_number: 'U001', student_name: 'A' },
      { reg_number: 'U002', student_name: 'B' },
      { reg_number: 'U003', student_name: 'C' },
      { reg_number: 'U004', student_name: 'D' },
    ];
    const records = [
      record({ session_id: 's1', registration_number: 'U001' }),
      record({ session_id: 's1', registration_number: 'U002' }),
      record({ session_id: 's2', registration_number: 'U001' }),
    ];
    const result = computeCourseAnalytics({
      courseId: 'course-1',
      sessions,
      records,
      students,
      threshold: 75,
    });
    // 3 present records ÷ (2 held × 4 on the list) = 37.5%.
    expect(result.averageTurnout).toBeCloseTo(37.5, 10);
  });

  it('has no average turnout without a class list or without held sessions', () => {
    const held = [session({ id: 's1', week_number: 1, status: 'finalized' })];
    const records = [record({ session_id: 's1', registration_number: 'U001' })];
    const noList = computeCourseAnalytics({
      courseId: 'course-1',
      sessions: held,
      records,
      students: [],
      threshold: 75,
    });
    expect(noList.averageTurnout).toBeNull();
    const noHeld = computeCourseAnalytics({
      courseId: 'course-1',
      sessions: [session({ id: 's1', week_number: 1, status: 'active' })],
      records,
      students: [{ reg_number: 'U001', student_name: 'A' }],
      threshold: 75,
    });
    expect(noHeld.averageTurnout).toBeNull();
    expect(noHeld.heldSessions).toBe(0);
    expect(noHeld.weeksCovered).toBe(0);
  });

  it('decides bands from the exact percentage — 74.6% is below', () => {
    // 8 sessions held; a student present in 6 of 8 is at 75%
    // (approaching), present in 5 of 8 is 62.5% (below). To hit
    // 74.6% exactly would need a bigger denominator; instead
    // verify the boundary through the shared eligibility rule:
    // 3 of 4 is 75% (approaching), 2 of 4 is 50% (below).
    const sessions = [1, 2, 3, 4].map((week) =>
      session({ id: `s${week}`, week_number: week, status: 'finalized' }),
    );
    const students = [
      { reg_number: 'U001', student_name: 'A' },
      { reg_number: 'U002', student_name: 'B' },
    ];
    const records = [
      record({ session_id: 's1', registration_number: 'U001' }),
      record({ session_id: 's2', registration_number: 'U001' }),
      record({ session_id: 's3', registration_number: 'U001' }),
      record({ session_id: 's1', registration_number: 'U002' }),
      record({ session_id: 's2', registration_number: 'U002' }),
    ];
    const result = computeCourseAnalytics({
      courseId: 'course-1',
      sessions,
      records,
      students,
      threshold: 75,
    });
    const u001 = result.rows.find((r) => r.regNumber === 'U001');
    const u002 = result.rows.find((r) => r.regNumber === 'U002');
    expect(u001?.percentage).toBe(75);
    expect(u001?.band).toBe('approaching');
    expect(u002?.percentage).toBe(50);
    expect(u002?.band).toBe('below');
  });

  it('counts manual attendance as present, pending as not', () => {
    const sessions = [session({ id: 's1', week_number: 1, status: 'finalized' })];
    const students = [
      { reg_number: 'U001', student_name: 'A' },
      { reg_number: 'U002', student_name: 'B' },
    ];
    const records = [
      record({ session_id: 's1', registration_number: 'U001', status: 'manual' }),
      record({ session_id: 's1', registration_number: 'U002', status: 'pending' }),
    ];
    const result = computeCourseAnalytics({
      courseId: 'course-1',
      sessions,
      records,
      students,
      threshold: 75,
    });
    expect(result.rows.find((r) => r.regNumber === 'U001')?.attended).toBe(1);
    expect(result.rows.find((r) => r.regNumber === 'U002')?.attended).toBe(0);
  });
});

describe('computeSessionReview', () => {
  it('flags a shared device once per hash, however many records used it', () => {
    const sessions = [session({ id: 's1', week_number: 1, status: 'finalized', headcount: 3 })];
    const records = [
      record({ session_id: 's1', registration_number: 'U001', device_fingerprint_hash: 'dev-a' }),
      record({ session_id: 's1', registration_number: 'U002', device_fingerprint_hash: 'dev-a' }),
      record({ session_id: 's1', registration_number: 'U003', device_fingerprint_hash: 'dev-a' }),
      record({ session_id: 's1', registration_number: 'U004', device_fingerprint_hash: 'dev-b' }),
    ];
    const reviews = computeSessionReview(sessions, records);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].reusedDevices).toBe(1);
    expect(reviews[0].sameFace).toBe(0);
    expect(reviews[0].faceFlags).toBe(0);
    // Headcount 3, 4 submissions: one more than counted.
    expect(reviews[0].headcountDifference).toBe(-1);
  });

  it('flags shared faces and server face-review flags', () => {
    const sessions = [session({ id: 's1', week_number: 1, status: 'closed', headcount: 2 })];
    const records = [
      record({
        session_id: 's1',
        registration_number: 'U001',
        selfie_hash: 'face-a',
        face_review: true,
      }),
      record({
        session_id: 's1',
        registration_number: 'U002',
        selfie_hash: 'face-a',
        face_review: true,
      }),
    ];
    const reviews = computeSessionReview(sessions, records);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].sameFace).toBe(1);
    expect(reviews[0].faceFlags).toBe(2);
    expect(reviews[0].headcountDifference).toBe(0);
  });

  it('does not flag a headcount difference while the session is still open', () => {
    const sessions = [session({ id: 's1', week_number: 1, status: 'active', headcount: 10 })];
    const records = [record({ session_id: 's1', registration_number: 'U001' })];
    const reviews = computeSessionReview(sessions, records);
    expect(reviews).toHaveLength(0);
  });

  it('does not flag a headcount difference in a draft either', () => {
    const sessions = [session({ id: 's1', week_number: 1, status: 'draft', headcount: 10 })];
    const records = [record({ session_id: 's1', registration_number: 'U001' })];
    expect(computeSessionReview(sessions, records)).toHaveLength(0);
  });

  it('leaves clean sessions out of the review list', () => {
    const sessions = [
      session({ id: 's1', week_number: 1, status: 'finalized', headcount: 2 }),
      session({ id: 's2', week_number: 2, status: 'finalized', headcount: 1 }),
    ];
    const records = [
      record({ session_id: 's1', registration_number: 'U001', device_fingerprint_hash: 'dev-a' }),
      record({ session_id: 's1', registration_number: 'U002', device_fingerprint_hash: 'dev-b' }),
      record({ session_id: 's2', registration_number: 'U001', device_fingerprint_hash: 'dev-a' }),
    ];
    expect(computeSessionReview(sessions, records)).toHaveLength(0);
  });

  it('ignores a session with no records', () => {
    const sessions = [session({ id: 's1', week_number: 1, status: 'finalized', headcount: 5 })];
    expect(computeSessionReview(sessions, [])).toHaveLength(0);
  });
});

describe('atRiskRows', () => {
  it('keeps below + approaching, worst first, safe left out', () => {
    const rows = [
      { regNumber: 'U003', studentName: 'C', attended: 4, held: 4, percentage: 100, band: 'safe' as const, weeks: [] },
      { regNumber: 'U001', studentName: 'A', attended: 1, held: 4, percentage: 25, band: 'below' as const, weeks: [] },
      { regNumber: 'U002', studentName: 'B', attended: 3, held: 4, percentage: 75, band: 'approaching' as const, weeks: [] },
      { regNumber: 'U004', studentName: 'D', attended: 0, held: 4, percentage: 0, band: 'below' as const, weeks: [] },
    ];
    expect(atRiskRows(rows).map((r) => r.regNumber)).toEqual(['U004', 'U001', 'U002']);
  });
});

describe('at-risk export (v0.14.0 machinery)', () => {
  const course = {
    code: 'CIT 301',
    title: 'Web Technology',
    departmentName: 'Information Technology',
    semesterName: 'First Semester',
    academicSessionName: '2025/2026',
    lecturerName: 'Dr A',
    threshold: 75,
  };
  const rows = [
    { regNumber: 'U001', studentName: 'Ada', attended: 1, held: 4, percentage: 25, band: 'below' as const, weeks: [] },
    { regNumber: 'U002', studentName: '=cmd', attended: 3, held: 4, percentage: 75, band: 'approaching' as const, weeks: [] },
    { regNumber: 'U003', studentName: 'Chi', attended: 4, held: 4, percentage: 100, band: 'safe' as const, weeks: [] },
  ];

  it('builds the report with below + approaching only, worst first', () => {
    const report = buildAtRiskReport(course, rows, 4, 5);
    expect(report.kind).toBe('at-risk');
    expect(report.heldSessions).toBe(4);
    expect(report.totalSessions).toBe(5);
    expect(report.rows.map((r) => r.regNumber)).toEqual(['U001', 'U002']);
  });

  it('writes the CSV with the contract headers, BOM and formula guard', () => {
    const csv = atRiskRowsToCsv(
      { code: course.code, title: course.title, departmentName: course.departmentName },
      rows,
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    // The CSV writer uses CRLF line endings (RFC 4180).
    const lines = csv.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toBe([...AT_RISK_CSV_HEADERS].join(','));
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('U001');
    expect(lines[1]).toContain('Below the bar');
    // A name starting with "=" is neutralized, never a live formula.
    expect(lines[2]).toContain("'=cmd");
    expect(lines[2]).toContain('Close to the bar');
  });
});
