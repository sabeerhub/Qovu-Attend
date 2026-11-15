import { describe, expect, it } from 'vitest';
import { canTransitionSession, isFinalized } from '@/lib/attendance';
import { canEditSessionRecords } from '@/lib/submission';
import type { SessionStatus } from '@/types/database';

/**
 * Phase 2 lifecycle guards: finalization is read-only, reopening is
 * only possible from closed, and manual/correction controls must
 * never be offered for finalized or archived sessions.
 */
describe('finalize is read-only', () => {
  it('finalized can only go to archived', () => {
    expect(canTransitionSession('finalized', 'archived')).toBe(true);
    expect(canTransitionSession('finalized', 'active')).toBe(false);
    expect(canTransitionSession('finalized', 'closed')).toBe(false);
    expect(canTransitionSession('finalized', 'draft')).toBe(false);
    expect(canTransitionSession('finalized', 'finalized')).toBe(false);
  });

  it('isFinalized marks finalized and archived as read-only', () => {
    expect(isFinalized('finalized')).toBe(true);
    expect(isFinalized('archived')).toBe(true);
    expect(isFinalized('closed')).toBe(false);
  });

  it('manual / correction controls are hidden for finalized and archived sessions', () => {
    expect(canEditSessionRecords('finalized')).toBe(false);
    expect(canEditSessionRecords('archived')).toBe(false);
  });

  it('manual / correction controls are available before finalization', () => {
    expect(canEditSessionRecords('draft')).toBe(true);
    expect(canEditSessionRecords('active')).toBe(true);
    expect(canEditSessionRecords('closed')).toBe(true);
  });
});

describe('reopen only from closed', () => {
  it('allows closed → active (reopen)', () => {
    expect(canTransitionSession('closed', 'active')).toBe(true);
  });

  it('forbids reopening from any other state', () => {
    const from: SessionStatus[] = ['draft', 'active', 'finalized', 'archived'];
    for (const state of from) {
      // draft → active is activation, not a reopen; it is allowed.
      if (state === 'draft') {
        expect(canTransitionSession(state, 'active')).toBe(true);
        continue;
      }
      expect(canTransitionSession(state, 'active')).toBe(false);
    }
  });

  it('forbids finalizing an active session directly (must close first)', () => {
    expect(canTransitionSession('active', 'finalized')).toBe(false);
    expect(canTransitionSession('closed', 'finalized')).toBe(true);
  });

  it('archived stays terminal in Phase 2 as well', () => {
    const statuses: SessionStatus[] = ['draft', 'active', 'closed', 'finalized', 'archived'];
    for (const to of statuses) {
      expect(canTransitionSession('archived', to)).toBe(false);
    }
  });
});
