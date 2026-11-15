import { describe, expect, it } from 'vitest';
import {
  isDateInSemester,
  validateLectureDate,
  weekDateRange,
  weekForDate,
  type SemesterDates,
} from '@/lib/calendar';

// Semester: 2026-01-05 (Mon) to 2026-04-24 (Fri). Week 1 = 5–11 Jan,
// week 2 = 12–18 Jan, …, week 15 = 13–19 Apr. The semester runs past
// week 15, so dates after 19 Apr are inside the semester but have no
// teaching week.
const semester: SemesterDates = { start_date: '2026-01-05', end_date: '2026-04-24' };

describe('weekForDate', () => {
  it('returns week 1 for the semester start date', () => {
    expect(weekForDate(semester, '2026-01-05')).toBe(1);
  });

  it('returns week 1 for the last day of the first 7 days', () => {
    expect(weekForDate(semester, '2026-01-11')).toBe(1);
  });

  it('returns week 2 for the first day after the first 7 days', () => {
    expect(weekForDate(semester, '2026-01-12')).toBe(2);
  });

  it('returns week 15 for the last day of the 15th week', () => {
    // Day 105 after 5 Jan is 19 Apr.
    expect(weekForDate(semester, '2026-04-19')).toBe(15);
  });

  it('returns null for a date in week 16 (inside the semester, beyond 15 weeks)', () => {
    expect(weekForDate(semester, '2026-04-20')).toBeNull();
    expect(weekForDate(semester, '2026-04-24')).toBeNull();
  });

  it('returns null for a date before the semester starts', () => {
    expect(weekForDate(semester, '2026-01-04')).toBeNull();
  });

  it('returns null for a date after the semester ends', () => {
    expect(weekForDate(semester, '2026-04-25')).toBeNull();
  });

  it('returns null for an invalid date string', () => {
    expect(weekForDate(semester, '2026-02-30')).toBeNull();
    expect(weekForDate(semester, 'not-a-date')).toBeNull();
  });
});

describe('isDateInSemester', () => {
  it('accepts the start and end dates themselves', () => {
    expect(isDateInSemester(semester, '2026-01-05')).toBe(true);
    expect(isDateInSemester(semester, '2026-04-24')).toBe(true);
  });

  it('rejects dates outside the semester', () => {
    expect(isDateInSemester(semester, '2026-01-04')).toBe(false);
    expect(isDateInSemester(semester, '2026-04-25')).toBe(false);
  });
});

describe('validateLectureDate', () => {
  it('accepts a date inside the 15 teaching weeks and reports its week', () => {
    expect(validateLectureDate(semester, '2026-01-05')).toEqual({ valid: true, week: 1 });
    expect(validateLectureDate(semester, '2026-02-09')).toEqual({ valid: true, week: 6 });
  });

  it('rejects a date outside the semester', () => {
    const result = validateLectureDate(semester, '2026-05-01');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/outside this semester/);
  });

  it('rejects a date inside the semester but beyond week 15', () => {
    const result = validateLectureDate(semester, '2026-04-22');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/15 teaching weeks/);
  });

  it('rejects an empty or invalid date', () => {
    expect(validateLectureDate(semester, '').valid).toBe(false);
    expect(validateLectureDate(semester, '2026-02-30').valid).toBe(false);
  });
});

describe('weekDateRange', () => {
  it('returns the 7-day range for a week', () => {
    expect(weekDateRange(semester, 1)).toEqual({ start: '2026-01-05', end: '2026-01-11' });
    expect(weekDateRange(semester, 15)).toEqual({ start: '2026-04-13', end: '2026-04-19' });
  });

  it('clips the range at the semester end date', () => {
    const short: SemesterDates = { start_date: '2026-01-05', end_date: '2026-01-10' };
    expect(weekDateRange(short, 2)).toEqual({ start: '2026-01-12', end: '2026-01-10' });
  });

  it('returns null for week 0 and week 16', () => {
    expect(weekDateRange(semester, 0)).toBeNull();
    expect(weekDateRange(semester, 16)).toBeNull();
  });
});
