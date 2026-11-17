import { describe, expect, it } from 'vitest';
import {
  isMoreNavKey,
  isTabBarKey,
  mobileNavActiveIndex,
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
  'analytics',
  'profile',
];

describe('mobile navigation grouping', () => {
  it('shows four tabs on the bar and five items behind More', () => {
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
      'analytics',
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

describe('mobileNavActiveIndex (v0.13.2 gliding indicator)', () => {
  it('returns the tab slot for the four tabs, in bar order', () => {
    expect(mobileNavActiveIndex('overview')).toBe(0);
    expect(mobileNavActiveIndex('courses')).toBe(1);
    expect(mobileNavActiveIndex('sessions')).toBe(2);
    expect(mobileNavActiveIndex('history')).toBe(3);
  });

  it('returns the More slot (4) for every section behind More', () => {
    for (const key of MORE_SHEET_ITEMS.map((item) => item.key)) {
      expect(mobileNavActiveIndex(key)).toBe(4);
    }
  });

  it('never returns an out-of-range slot for any section', () => {
    for (const key of ALL_KEYS) {
      const index = mobileNavActiveIndex(key);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(4);
    }
  });
});
