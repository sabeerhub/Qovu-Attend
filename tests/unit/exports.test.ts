import { describe, expect, it } from 'vitest';
import {
  bandLabel,
  buildCourseReport,
  buildSessionReport,
  courseCsvFilename,
  courseRecordsToCsv,
  formatPercentage,
  methodLabel,
  sessionCsvFilename,
  sessionRecordsToCsv,
  slugify,
  statusLabel,
  type ExportRecord,
  type ExportSession,
} from '@/lib/exports';
import { CSV_BOM } from '@/lib/csv';

const CONTEXT = {
  departmentName: 'Computer Science',
  courseCode: 'CSC 301',
  courseTitle: 'Computer Architecture',
  academicSessionName: '2025/2026',
  semesterName: 'First Semester',
};

const SESSION_CONTEXT = { ...CONTEXT, lecturerName: 'Mustapha Abdulsalam Sabeer', roomName: 'LT 1' };

function record(overrides: Partial<ExportRecord> = {}): ExportRecord {
  return {
    registration_number: 'FUD/2021/001',
    student_name: 'Amina Bello',
    status: 'verified',
    verification_method: 'qr',
    submitted_at: '2026-11-10T09:05:00.000Z',
    manual_reason: null,
    ...overrides,
  };
}

function session(overrides: Partial<ExportSession> = {}): ExportSession {
  return {
    id: 's1',
    title: 'Week 3 Lecture',
    lecture_date: '2026-11-10',
    week_number: 3,
    status: 'finalized',
    headcount: 40,
    ...overrides,
  };
}

describe('export labels', () => {
  it('capitalizes statuses and names verification methods', () => {
    expect(statusLabel('verified')).toBe('Verified');
    expect(statusLabel('suspicious')).toBe('Suspicious');
    expect(methodLabel('qr')).toBe('QR code');
    expect(methodLabel('passcode')).toBe('Passcode');
    expect(methodLabel('manual')).toBe('Manual');
    expect(methodLabel(null)).toBe('—');
    expect(methodLabel('something-else')).toBe('—');
  });

  it('names eligibility bands in plain words', () => {
    expect(bandLabel('below')).toBe('Below the bar');
    expect(bandLabel('approaching')).toBe('Close to the bar');
    expect(bandLabel('safe')).toBe('Safe');
    expect(bandLabel(null)).toBe('—');
  });

  it('formats percentages to one decimal, dash when nothing held', () => {
    expect(formatPercentage(74.6)).toBe('74.6%');
    expect(formatPercentage(100)).toBe('100.0%');
    expect(formatPercentage(null)).toBe('—');
  });

  it('slugifies codes for filenames', () => {
    expect(slugify('CSC 301')).toBe('csc-301');
    expect(slugify('CIT/305 (A)')).toBe('cit-305-a');
  });
});

describe('session CSV', () => {
  it('starts with a UTF-8 BOM and the contract headers, in order', () => {
    const csv = sessionRecordsToCsv(CONTEXT, session(), []);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    const firstLine = csv.slice(CSV_BOM.length).split('\r\n')[0];
    expect(firstLine).toBe(
      'Registration number,Student name,Department,Course code,Academic session,Semester,Week,Attendance title,Lecture date,Attendance status,Verification method,Submission timestamp,Manual attendance reason',
    );
  });

  it('writes one row per record with the session context stamped on it', () => {
    const csv = sessionRecordsToCsv(CONTEXT, session(), [
      record(),
      record({
        registration_number: 'FUD/2021/002',
        student_name: null,
        status: 'manual',
        verification_method: 'manual',
        submitted_at: '2026-11-10T09:06:00.000Z',
        manual_reason: 'No phone',
      }),
    ]);
    const lines = csv.slice(CSV_BOM.length).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(
      'FUD/2021/001,Amina Bello,Computer Science,CSC 301,2025/2026,First Semester,3,Week 3 Lecture,2026-11-10,Verified,QR code,2026-11-10T09:05:00.000Z,',
    );
    expect(lines[2]).toBe(
      'FUD/2021/002,,Computer Science,CSC 301,2025/2026,First Semester,3,Week 3 Lecture,2026-11-10,Manual,Manual,2026-11-10T09:06:00.000Z,No phone',
    );
  });

  it('orders rows by submission time, not by load order', () => {
    const csv = sessionRecordsToCsv(CONTEXT, session(), [
      record({ registration_number: 'FUD/2021/002', submitted_at: '2026-11-10T09:06:00.000Z' }),
      record({ registration_number: 'FUD/2021/001', submitted_at: '2026-11-10T09:05:00.000Z' }),
    ]);
    const lines = csv.slice(CSV_BOM.length).split('\r\n');
    expect(lines[1].startsWith('FUD/2021/001')).toBe(true);
    expect(lines[2].startsWith('FUD/2021/002')).toBe(true);
  });

  it('neutralizes a formula in a registration number', () => {
    const csv = sessionRecordsToCsv(CONTEXT, session(), [
      record({ registration_number: '=1+1' }),
    ]);
    expect(csv).toContain("'=1+1");
  });

  it('names the file from the course, week and date', () => {
    expect(sessionCsvFilename('CSC 301', session(), new Date('2026-11-17T10:00:00.000Z'))).toBe(
      'qovu-csc-301-week-3-2026-11-10-attendance-2026-11-17.csv',
    );
    expect(courseCsvFilename('CSC 301', new Date('2026-11-17T10:00:00.000Z'))).toBe(
      'qovu-csc-301-attendance-2026-11-17.csv',
    );
  });
});

describe('course CSV (session-level detail)', () => {
  it('writes every session in date order with its own week and title', () => {
    const sessions = [
      session({ id: 's2', title: 'Week 4 Lecture', lecture_date: '2026-11-17', week_number: 4 }),
      session({ id: 's1' }),
    ];
    const csv = courseRecordsToCsv(CONTEXT, sessions, [
      { ...record(), session_id: 's2', registration_number: 'FUD/2021/002' },
      { ...record(), session_id: 's1', registration_number: 'FUD/2021/001' },
    ]);
    const lines = csv.slice(CSV_BOM.length).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Week 3 Lecture,2026-11-10');
    expect(lines[2]).toContain('Week 4 Lecture,2026-11-17');
  });

  it('leaves out records for sessions that are not in the list', () => {
    const csv = courseRecordsToCsv(CONTEXT, [session()], [
      { ...record(), session_id: 'not-a-session' },
    ]);
    expect(csv.slice(CSV_BOM.length).split('\r\n')).toHaveLength(1);
  });
});

describe('session report data', () => {
  it('counts the summary and the headcount difference', () => {
    const fullSession = {
      ...session(),
      course_id: 'c1',
      lecturer_id: 'l1',
      semester_id: 'sem1',
      lecture_room_id: null,
      start_time: '09:00',
      qr_expires_in_seconds: 300,
      created_at: '2026-11-10T08:00:00.000Z',
      updated_at: '2026-11-10T08:00:00.000Z',
      qr_token_hash: null,
      qr_token_issued_at: null,
      passcode_hash: null,
      anchor_latitude: null,
      anchor_longitude: null,
      anchor_accuracy_meters: null,
      anchor_captured_at: null,
      location_radius_meters: 30,
    };
    const report = buildSessionReport(
      SESSION_CONTEXT,
      fullSession,
      [
        record(),
        record({ registration_number: 'FUD/2021/002', status: 'manual', verification_method: 'manual' }),
        record({ registration_number: 'FUD/2021/003', status: 'pending', verification_method: 'passcode' }),
      ],
      new Date('2026-11-17T10:00:00.000Z'),
    );
    expect(report.kind).toBe('session');
    expect(report.summary).toEqual(
      expect.objectContaining({ total: 3, verified: 1, manual: 1, pending: 1 }),
    );
    expect(report.difference).toBe(37);
    expect(report.context.lecturerName).toBe('Mustapha Abdulsalam Sabeer');
    expect(report.generatedAt).toBe('2026-11-17T10:00:00.000Z');
  });

  it('has no difference when no headcount was recorded', () => {
    const fullSession = {
      ...session(),
      course_id: 'c1',
      lecturer_id: 'l1',
      semester_id: 'sem1',
      lecture_room_id: null,
      start_time: null,
      headcount: null,
      qr_expires_in_seconds: 300,
      created_at: '2026-11-10T08:00:00.000Z',
      updated_at: '2026-11-10T08:00:00.000Z',
      qr_token_hash: null,
      qr_token_issued_at: null,
      passcode_hash: null,
      anchor_latitude: null,
      anchor_longitude: null,
      anchor_accuracy_meters: null,
      anchor_captured_at: null,
      location_radius_meters: 30,
    };
    const report = buildSessionReport(SESSION_CONTEXT, fullSession, [], new Date('2026-11-17T10:00:00.000Z'));
    expect(report.difference).toBe(null);
    expect(report.summary.total).toBe(0);
  });
});

describe('course report data', () => {
  it('reuses the eligibility computation — same held rule, same exact percentage', () => {
    const sessions = [
      session({ id: 's1', status: 'finalized' }),
      session({ id: 's2', title: 'Week 4 Lecture', lecture_date: '2026-11-17', week_number: 4, status: 'finalized' }),
      session({ id: 's3', title: 'Week 5 Lecture', lecture_date: '2026-11-24', week_number: 5, status: 'active' }),
    ];
    const report = buildCourseReport(
      { ...CONTEXT, code: 'CSC 301', title: 'Computer Architecture', lecturerName: 'Mustapha Abdulsalam Sabeer', threshold: 75 },
      sessions,
      [
        { ...record(), session_id: 's1' },
        { ...record(), session_id: 's2' },
        { ...record(), session_id: 's3' },
        { ...record({ registration_number: 'FUD/2021/002' }), session_id: 's1' },
      ],
      [
        { reg_number: 'FUD/2021/001', student_name: 'Amina Bello' },
        { reg_number: 'FUD/2021/002', student_name: 'Chidi Okafor' },
      ],
      new Date('2026-11-17T10:00:00.000Z'),
    );
    expect(report.kind).toBe('course');
    expect(report.totalSessions).toBe(3);
    expect(report.heldSessions).toBe(2);
    // The active session does not count as held, so 2 of 2 = 100%.
    const first = report.rows.find((r) => r.regNumber === 'FUD/2021/001');
    expect(first?.attended).toBe(2);
    expect(first?.held).toBe(2);
    expect(first?.percentage).toBe(100);
    expect(first?.band).toBe('safe');
    // 1 of 2 = 50% — below the 75 bar.
    const second = report.rows.find((r) => r.regNumber === 'FUD/2021/002');
    expect(second?.percentage).toBe(50);
    expect(second?.band).toBe('below');
    // Per-session present counts: s3 counts the submission too
    // (it is a real submission), even though it is not held yet.
    expect(report.sessions.find((s) => s.id === 's3')?.present).toBe(1);
  });
});
