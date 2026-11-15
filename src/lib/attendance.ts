import type { SessionStatus } from '../types/database';

/** A semester has exactly 15 teaching weeks by default (spec §6). */
export const MIN_WEEK = 1;
export const MAX_WEEK = 15;

export function isValidWeekNumber(week: unknown): week is number {
  return (
    typeof week === 'number' &&
    Number.isInteger(week) &&
    week >= MIN_WEEK &&
    week <= MAX_WEEK
  );
}

export function weekOptions(): number[] {
  return Array.from({ length: MAX_WEEK }, (_, i) => i + 1);
}

/**
 * Allowed session lifecycle transitions (spec §7, ATTENDANCE_RULES.md).
 * `closed -> active` (reopen) is allowed only before finalization.
 * `archived` is terminal. `finalized` can only go to `archived`.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<SessionStatus, readonly SessionStatus[]>> = {
  draft: ['active', 'archived'],
  active: ['closed'],
  closed: ['finalized', 'active'],
  finalized: ['archived'],
  archived: [],
};

export function canTransitionSession(from: SessionStatus, to: SessionStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isFinalized(status: SessionStatus): boolean {
  return status === 'finalized' || status === 'archived';
}
