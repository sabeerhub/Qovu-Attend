import { describe, expect, it } from 'vitest';
import { hasSessionFormErrors, validateSessionForm, type SessionFormInput } from '@/lib/sessionForm';
import type { SemesterDates } from '@/lib/calendar';

// Semester 2026-01-05 → 2026-04-24. 2026-02-09 is a Monday in week 6.
const semester: SemesterDates = { start_date: '2026-01-05', end_date: '2026-04-24' };

function validInput(overrides: Partial<SessionFormInput> = {}): SessionFormInput {
  return {
    departmentId: 'dept-it',
    courseId: 'cit-301',
    title: 'Introduction to React Hooks',
    lectureDate: '2026-02-09',
    weekNumber: 6,
    headcount: 60,
    qrExpiresInSeconds: 300,
    lectureRoomId: null,
    ...overrides,
  };
}

describe('validateSessionForm', () => {
  it('accepts a fully valid form', () => {
    const errors = validateSessionForm(validInput(), semester);
    expect(errors).toEqual({});
    expect(hasSessionFormErrors(errors)).toBe(false);
  });

  it('rejects a week/date mismatch', () => {
    // 2026-02-09 is week 6, not week 5.
    const errors = validateSessionForm(validInput({ weekNumber: 5 }), semester);
    expect(errors.weekNumber).toMatch(/week 6/);
    expect(hasSessionFormErrors(errors)).toBe(true);
  });

  it('accepts the week the date actually falls in', () => {
    expect(validateSessionForm(validInput({ weekNumber: 6 }), semester)).toEqual({});
  });

  it('rejects a lecture date outside the semester', () => {
    const errors = validateSessionForm(validInput({ lectureDate: '2026-05-01' }), semester);
    expect(errors.lectureDate).toMatch(/outside this semester/);
  });

  it('rejects a lecture date beyond the 15 teaching weeks', () => {
    const errors = validateSessionForm(validInput({ lectureDate: '2026-04-22' }), semester);
    expect(errors.lectureDate).toMatch(/15 teaching weeks/);
  });

  it('rejects a negative headcount', () => {
    const errors = validateSessionForm(validInput({ headcount: -1 }), semester);
    expect(errors.headcount).toMatch(/0 or more/);
  });

  it('rejects a non-integer headcount', () => {
    const errors = validateSessionForm(validInput({ headcount: 12.5 }), semester);
    expect(errors.headcount).toMatch(/whole number/);
  });

  it('accepts a zero headcount and a missing headcount', () => {
    expect(validateSessionForm(validInput({ headcount: 0 }), semester)).toEqual({});
    expect(validateSessionForm(validInput({ headcount: null }), semester)).toEqual({});
  });

  it('rejects week 0 and week 16', () => {
    expect(validateSessionForm(validInput({ weekNumber: 0 }), semester).weekNumber).toMatch(/1 and 15/);
    expect(validateSessionForm(validInput({ weekNumber: 16 }), semester).weekNumber).toMatch(/1 and 15/);
  });

  it('rejects an empty title, department and course', () => {
    const errors = validateSessionForm(
      validInput({ title: '   ', departmentId: '', courseId: '' }),
      semester,
    );
    expect(errors.title).toBeDefined();
    expect(errors.departmentId).toBeDefined();
    expect(errors.courseId).toBeDefined();
  });

  it('rejects a QR expiry outside 60 / 300 / 600 / 900 seconds', () => {
    const errors = validateSessionForm(validInput({ qrExpiresInSeconds: 120 }), semester);
    expect(errors.qrExpiresInSeconds).toMatch(/60, 300, 600 or 900/);
    for (const seconds of [60, 300, 600, 900]) {
      expect(validateSessionForm(validInput({ qrExpiresInSeconds: seconds }), semester)).toEqual({});
    }
  });

  it('reports a missing semester instead of validating the date', () => {
    const errors = validateSessionForm(validInput(), null);
    expect(errors.lectureDate).toMatch(/no semester configured/);
  });
});
