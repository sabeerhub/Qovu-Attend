import { describe, expect, it } from 'vitest';
import { canTransitionSession, isFinalized } from '@/lib/attendance';
import type { SessionStatus } from '@/types/database';

describe('session lifecycle transitions', () => {
  it('allows the happy path draft → active → closed → finalized → archived', () => {
    expect(canTransitionSession('draft', 'active')).toBe(true);
    expect(canTransitionSession('active', 'closed')).toBe(true);
    expect(canTransitionSession('closed', 'finalized')).toBe(true);
    expect(canTransitionSession('finalized', 'archived')).toBe(true);
  });

  it('allows reopening a closed session before finalization', () => {
    expect(canTransitionSession('closed', 'active')).toBe(true);
  });

  it('allows archiving a draft', () => {
    expect(canTransitionSession('draft', 'archived')).toBe(true);
  });

  it('forbids skipping steps and going backwards', () => {
    expect(canTransitionSession('draft', 'closed')).toBe(false);
    expect(canTransitionSession('draft', 'finalized')).toBe(false);
    expect(canTransitionSession('active', 'draft')).toBe(false);
    expect(canTransitionSession('active', 'finalized')).toBe(false);
    expect(canTransitionSession('closed', 'draft')).toBe(false);
  });

  it('treats archived as terminal', () => {
    const statuses: SessionStatus[] = ['draft', 'active', 'closed', 'finalized', 'archived'];
    for (const to of statuses) {
      expect(canTransitionSession('archived', to)).toBe(false);
    }
  });

  it('marks finalized and archived as read-only', () => {
    expect(isFinalized('finalized')).toBe(true);
    expect(isFinalized('archived')).toBe(true);
    expect(isFinalized('draft')).toBe(false);
    expect(isFinalized('active')).toBe(false);
    expect(isFinalized('closed')).toBe(false);
  });
});
