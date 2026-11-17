/**
 * Mobile navigation grouping (pure, tested).
 *
 * Mobile uses an iOS-style bottom tab bar with four tabs and a
 * "More" tab that opens a bottom sheet with the remaining sections.
 * Every one of the 8 nav sections appears exactly once across the
 * tab bar and the sheet — nothing is hidden, nothing is duplicated.
 */
import type { NavKey } from '@/app/routes';

export interface MobileNavItem {
  key: NavKey;
  label: string;
}

/** The four keys that appear as tabs on the bottom bar. */
export type TabBarKey = 'overview' | 'courses' | 'sessions' | 'history';

/** The four tabs on the bottom bar. Labels stay short so they fit. */
export const TAB_BAR_ITEMS: Array<{ key: TabBarKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'courses', label: 'Courses' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'history', label: 'History' },
];

/** The sections behind the "More" tab, shown in the bottom sheet. */
export const MORE_SHEET_ITEMS: MobileNavItem[] = [
  { key: 'departments', label: 'My Departments' },
  { key: 'plan', label: 'My Lecture Plan' },
  { key: 'reports', label: 'Reports & Exports' },
  { key: 'profile', label: 'Profile & Settings' },
];

export function isTabBarKey(key: NavKey): boolean {
  return TAB_BAR_ITEMS.some((item) => item.key === key);
}

/** True for sections that live behind the "More" tab. */
export function isMoreNavKey(key: NavKey): boolean {
  return MORE_SHEET_ITEMS.some((item) => item.key === key);
}

/**
 * Slot index of the section that is active in the mobile pill
 * (v0.13.2): 0–3 for the four tabs, 4 for anything behind the
 * "More" tab. The gliding active indicator is positioned from
 * this index alone — one slot per step, driven by a transform,
 * so the pill glides instead of jumping.
 */
export function mobileNavActiveIndex(current: NavKey): number {
  const tabIndex = TAB_BAR_ITEMS.findIndex((item) => item.key === current);
  return tabIndex === -1 ? TAB_BAR_ITEMS.length : tabIndex;
}
