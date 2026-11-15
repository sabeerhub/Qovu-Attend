import { describe, expect, it } from 'vitest';
import { isValidWeekNumber, MAX_WEEK, MIN_WEEK, weekOptions } from '@/lib/attendance';

describe('week validation', () => {
  it('accepts weeks 1–15', () => {
    for (let week = 1; week <= 15; week++) {
      expect(isValidWeekNumber(week)).toBe(true);
    }
  });

  it('rejects week 0 and week 16', () => {
    expect(isValidWeekNumber(0)).toBe(false);
    expect(isValidWeekNumber(16)).toBe(false);
  });

  it('rejects non-integers and non-numbers', () => {
    expect(isValidWeekNumber(1.5)).toBe(false);
    expect(isValidWeekNumber('5')).toBe(false);
    expect(isValidWeekNumber(null)).toBe(false);
    expect(isValidWeekNumber(undefined)).toBe(false);
    expect(isValidWeekNumber(NaN)).toBe(false);
  });

  it('exposes the 1–15 bounds and all 15 week options', () => {
    expect(MIN_WEEK).toBe(1);
    expect(MAX_WEEK).toBe(15);
    expect(weekOptions()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });
});
