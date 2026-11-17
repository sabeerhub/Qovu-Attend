import { describe, expect, it } from 'vitest';
import {
  buildBulkMarkAuditRows,
  buildBulkMarkRecords,
  computeBulkMarkTargets,
  summarizeBulkMarkRun,
} from '../../supabase/functions/manual-attendance/bulkMark';

describe('computeBulkMarkTargets', () => {
  it('marks list numbers with no record and skips numbers that already submitted', () => {
    expect(
      computeBulkMarkTargets(
        ['FUT/2022/001', 'FUT/2022/002', 'FUT/2022/003'],
        ['FUT/2022/002'],
      ),
    ).toEqual({
      toMark: ['FUT/2022/001', 'FUT/2022/003'],
      skipped: ['FUT/2022/002'],
    });
  });

  it('matches on the normalized form, so case and spaces never double-mark', () => {
    expect(
      computeBulkMarkTargets([' fut/2022/001 ', 'FUT/2022/002'], ['FUT/2022/001']),
    ).toEqual({ toMark: ['FUT/2022/002'], skipped: ['FUT/2022/001'] });
  });

  it('marks a repeated number on the list once at most', () => {
    expect(
      computeBulkMarkTargets(['FUT/2022/001', 'FUT/2022/001'], []),
    ).toEqual({ toMark: ['FUT/2022/001'], skipped: [] });
  });

  it('marks nobody new when everyone already submitted (a second run)', () => {
    expect(
      computeBulkMarkTargets(
        ['FUT/2022/001', 'FUT/2022/002'],
        ['FUT/2022/001', 'FUT/2022/002'],
      ),
    ).toEqual({ toMark: [], skipped: ['FUT/2022/001', 'FUT/2022/002'] });
  });

  it('marks everyone when the session has no records yet', () => {
    expect(computeBulkMarkTargets(['FUT/2022/001'], [])).toEqual({
      toMark: ['FUT/2022/001'],
      skipped: [],
    });
  });

  it('ignores blank rows on the list', () => {
    expect(computeBulkMarkTargets(['', '   ', 'FUT/2022/001'], [])).toEqual({
      toMark: ['FUT/2022/001'],
      skipped: [],
    });
  });
});

describe('buildBulkMarkRecords', () => {
  it('builds manual records with the shared reason, one per number', () => {
    expect(
      buildBulkMarkRecords('s1', ['FUT/2022/001', 'FUT/2022/002'], 'Marked all as arrived by lecturer'),
    ).toEqual([
      {
        session_id: 's1',
        registration_number: 'FUT/2022/001',
        status: 'manual',
        verification_method: 'manual',
        manual_reason: 'Marked all as arrived by lecturer',
      },
      {
        session_id: 's1',
        registration_number: 'FUT/2022/002',
        status: 'manual',
        verification_method: 'manual',
        manual_reason: 'Marked all as arrived by lecturer',
      },
    ]);
  });
});

describe('buildBulkMarkAuditRows', () => {
  it('writes one audit row per marked record, same as a single manual add', () => {
    expect(
      buildBulkMarkAuditRows(
        's1',
        [{ id: 'r1' }, { id: 'r2' }],
        'lect-1',
        'Marked all as arrived by lecturer',
      ),
    ).toEqual([
      {
        session_id: 's1',
        record_id: 'r1',
        lecturer_id: 'lect-1',
        action: 'bulk_manual_attendance',
        previous_status: null,
        new_status: 'manual',
        reason: 'Marked all as arrived by lecturer',
      },
      {
        session_id: 's1',
        record_id: 'r2',
        lecturer_id: 'lect-1',
        action: 'bulk_manual_attendance',
        previous_status: null,
        new_status: 'manual',
        reason: 'Marked all as arrived by lecturer',
      },
    ]);
  });
});

describe('summarizeBulkMarkRun', () => {
  it('counts marked, skipped and failed from the per-row fallback', () => {
    expect(
      summarizeBulkMarkRun(
        ['marked', 'skipped', 'failed', 'marked'],
        ['FUT/2022/003'],
      ),
    ).toEqual({
      marked: 2,
      skipped: 1,
      failed: 1,
      failedNumbers: ['FUT/2022/003'],
    });
  });

  it('an all-skipped run is zero marked, zero failed', () => {
    expect(summarizeBulkMarkRun(['skipped', 'skipped'], [])).toEqual({
      marked: 0,
      skipped: 2,
      failed: 0,
      failedNumbers: [],
    });
  });
});
