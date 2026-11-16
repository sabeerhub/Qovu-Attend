import { describe, expect, it } from 'vitest';
import {
  isMoreNavKey,
  isTabBarKey,
  MORE_SHEET_ITEMS,
  TAB_BAR_ITEMS,
} from '@/lib/navigation';
import type { NavKey } from '@/app/routes';

const ALL_KEYS: NavKey[] = [
  'overview',
  'departments',
  'courses',
  'plan',
  'sessions',
  'history',
  'reports',
  'profile',
];

describe('mobile navigation grouping', () => {
  it('shows four tabs on the bar and four items behind More', () => {
    expect(TAB_BAR_ITEMS.map((item) => item.key)).toEqual([
      'overview',
      'courses',
      'sessions',
      'history',
    ]);
    expect(MORE_SHEET_ITEMS.map((item) => item.key)).toEqual([
      'departments',
      'plan',
      'reports',
      'profile',
    ]);
  });

  it('covers every nav section exactly once across bar and sheet', () => {
    const covered = [...TAB_BAR_ITEMS, ...MORE_SHEET_ITEMS].map((item) => item.key).sort();
    expect(covered).toEqual([...ALL_KEYS].sort());
    expect(new Set(covered).size).toBe(covered.length);
  });

  it('every tab and sheet item has a short label', () => {
    for (const item of [...TAB_BAR_ITEMS, ...MORE_SHEET_ITEMS]) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.label.length).toBeLessThanOrEqual(20);
    }
  });

  it('classifies tab-bar and More keys correctly', () => {
    for (const key of TAB_BAR_ITEMS.map((item) => item.key)) {
      expect(isTabBarKey(key)).toBe(true);
      expect(isMoreNavKey(key)).toBe(false);
    }
    for (const key of MORE_SHEET_ITEMS.map((item) => item.key)) {
      expect(isMoreNavKey(key)).toBe(true);
      expect(isTabBarKey(key)).toBe(false);
    }
  });
});
