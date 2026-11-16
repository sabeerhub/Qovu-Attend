import { describe, expect, it } from 'vitest';
import {
  hasSessionFormErrors,
  isValidStartTime,
  suggestedWeekForLectureDate,
  validateSessionForm,
  type SessionFormInput,
} from '@/lib/sessionForm';
import type { SemesterDates } from '@/lib/calendar';

// Semester 2026-01-05 → 2026-04-24. 2026-02-09 is a Monday in week 6.
// Since v0.4.1 the semester dates no longer gate session creation:
// the lecturer sets the date, start time and week freely, so these
// dates only matter for the week auto-suggest rule below.
const semester: SemesterDates = { start_date: '2026-01-05', end_date: '2026-04-24' };

function validInput(overrides: Partial<SessionFormInput> = {}): SessionFormInput {
  return {
    departmentId: 'dept-it',
    courseId: 'cit-301',
    title: 'Introduction to React Hooks',
    lectureDate: '2026-02-09',
    startTime: '09:00',
    weekNumber: 6,
    headcount: 60,
    qrExpiresInSeconds: 300,
    lectureRoomId: null,
    ...overrides,
  };
}

describe('validateSessionForm', () => {
  it('accepts a fully valid form', () => {
    const errors = validateSessionForm(validInput());
    expect(errors).toEqual({});
    expect(hasSessionFormErrors(errors)).toBe(false);
  });

  it('accepts a lecture date outside the semester dates', () => {
    // Stale example semester (ends 2026-04-24); a November date is fine now.
    expect(validateSessionForm(validInput({ lectureDate: '2026-11-16' }))).toEqual({});
    expect(validateSessionForm(validInput({ lectureDate: '2026-05-01' }))).toEqual({});
  });

  it('accepts a lecture date beyond the 15 teaching weeks', () => {
    expect(validateSessionForm(validInput({ lectureDate: '2026-04-22' }))).toEqual({});
  });

  it('accepts any week with any date — no week/date match is required', () => {
    // 2026-02-09 falls in week 6; week 5 is accepted anyway.
    expect(validateSessionForm(validInput({ weekNumber: 5 }))).toEqual({});
    expect(validateSessionForm(validInput({ weekNumber: 1, lectureDate: '2026-11-16' }))).toEqual(
      {},
    );
  });

  it('rejects a missing lecture date and an impossible one', () => {
    expect(validateSessionForm(validInput({ lectureDate: '' })).lectureDate).toMatch(
      /Choose a lecture date/,
    );
    expect(validateSessionForm(validInput({ lectureDate: '2026-02-30' })).lectureDate).toMatch(
      /valid date/,
    );
    expect(validateSessionForm(validInput({ lectureDate: 'not-a-date' })).lectureDate).toMatch(
      /valid date/,
    );
  });

  it('rejects a missing lecture start time', () => {
    const errors = validateSessionForm(validInput({ startTime: '' }));
    expect(errors.startTime).toMatch(/Choose a lecture start time/);
    expect(hasSessionFormErrors(errors)).toBe(true);
  });

  it('rejects an invalid lecture start time', () => {
    for (const bad of ['25:00', '9:00', '09:60', '09:00:00', 'noon', '09-00']) {
      expect(validateSessionForm(validInput({ startTime: bad })).startTime).toMatch(
        /24-hour time/,
      );
    }
  });

  it('accepts valid lecture start times', () => {
    for (const good of ['00:00', '09:00', '13:30', '23:59']) {
      expect(validateSessionForm(validInput({ startTime: good }))).toEqual({});
    }
  });

  it('rejects a negative headcount', () => {
    const errors = validateSessionForm(validInput({ headcount: -1 }));
    expect(errors.headcount).toMatch(/0 or more/);
  });

  it('rejects a non-integer headcount', () => {
    const errors = validateSessionForm(validInput({ headcount: 12.5 }));
    expect(errors.headcount).toMatch(/whole number/);
  });

  it('accepts a zero headcount and a missing headcount', () => {
    expect(validateSessionForm(validInput({ headcount: 0 }))).toEqual({});
    expect(validateSessionForm(validInput({ headcount: null }))).toEqual({});
  });

  it('rejects week 0 and week 16', () => {
    expect(validateSessionForm(validInput({ weekNumber: 0 })).weekNumber).toMatch(/1 and 15/);
    expect(validateSessionForm(validInput({ weekNumber: 16 })).weekNumber).toMatch(/1 and 15/);
  });

  it('rejects an empty title, department and course', () => {
    const errors = validateSessionForm(
      validInput({ title: '   ', departmentId: '', courseId: '' }),
    );
    expect(errors.title).toBeDefined();
    expect(errors.departmentId).toBeDefined();
    expect(errors.courseId).toBeDefined();
  });

  it('rejects a QR expiry outside 60 / 300 / 600 / 900 seconds', () => {
    const errors = validateSessionForm(validInput({ qrExpiresInSeconds: 120 }));
    expect(errors.qrExpiresInSeconds).toMatch(/60, 300, 600 or 900/);
    for (const seconds of [60, 300, 600, 900]) {
      expect(validateSessionForm(validInput({ qrExpiresInSeconds: seconds }))).toEqual({});
    }
  });
});

describe('isValidStartTime', () => {
  it('accepts 24-hour HH:MM times', () => {
    for (const good of ['00:00', '08:05', '12:30', '23:59']) {
      expect(isValidStartTime(good)).toBe(true);
    }
  });

  it('rejects anything that is not HH:MM', () => {
    for (const bad of ['', '9:00', '24:00', '12:60', '12:30:00', '12-30', 'noon']) {
      expect(isValidStartTime(bad)).toBe(false);
    }
  });
});

describe('suggestedWeekForLectureDate', () => {
  it('suggests the derived week when the date falls inside the semester', () => {
    expect(suggestedWeekForLectureDate(semester, '2026-02-09')).toBe(6);
    expect(suggestedWeekForLectureDate(semester, '2026-01-05')).toBe(1);
    expect(suggestedWeekForLectureDate(semester, '2026-04-19')).toBe(15);
  });

  it('suggests nothing when the date falls outside the semester', () => {
    // The lecturer's chosen week stands; there is no hint to show.
    expect(suggestedWeekForLectureDate(semester, '2026-11-16')).toBeNull();
    expect(suggestedWeekForLectureDate(semester, '2026-05-01')).toBeNull();
    expect(suggestedWeekForLectureDate(semester, '2026-04-22')).toBeNull();
  });

  it('suggests nothing without a semester or a date', () => {
    expect(suggestedWeekForLectureDate(null, '2026-02-09')).toBeNull();
    expect(suggestedWeekForLectureDate(semester, '')).toBeNull();
  });
});
