import { describe, expect, it } from 'vitest';
import {
  ATTEMPT_REASONS,
  logAttempt,
  normalizeAttemptRegNo,
  type AttemptLogQuery,
  type AttemptReason,
} from '../../supabase/functions/attendance-submit/attemptLog';

/**
 * Minimal fake of the Supabase insert for the attempts table: it
 * records what was inserted, and can be made to fail or throw.
 * It proves what the log actually writes — and that a logging
 * failure can never break the refusal it belongs to.
 */
function fakeClient(options: {
  error?: { message: string } | null;
  throws?: boolean;
} = {}): {
  client: AttemptLogQuery;
  inserts: Array<{ table: string; row: Record<string, unknown> }>;
} {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  return {
    inserts,
    client: {
      from: (table: string) => ({
        insert: async (row: {
          session_id: string;
          registration_number: string;
          reason: AttemptReason;
        }) => {
          if (options.throws) throw new Error('client exploded');
          inserts.push({ table, row });
          return { error: options.error ?? null };
        },
      }),
    },
  };
}

describe('normalizeAttemptRegNo', () => {
  it('trims and uppercases, the same form records use', () => {
    expect(normalizeAttemptRegNo('  fud/2022/001 ')).toBe('FUD/2022/001');
    expect(normalizeAttemptRegNo('FUD/2022/001')).toBe('FUD/2022/001');
  });
});

describe('ATTEMPT_REASONS', () => {
  it('is exactly the seven logged reasons — kept in sync with the CHECK constraint', () => {
    expect([...ATTEMPT_REASONS]).toEqual([
      'already_submitted',
      'device_already_used',
      'device_registered_to_other',
      'outside_hall',
      'location_imprecise',
      'not_on_class_list',
      'selfie_missing',
    ]);
  });
});

describe('logAttempt', () => {
  it('inserts one row into attendance_attempts with session, normalized number and reason', async () => {
    const { client, inserts } = fakeClient();
    await expect(
      logAttempt(client, 'session-1', ' fud/2022/001 ', 'outside_hall'),
    ).resolves.toEqual({ ok: true });
    expect(inserts).toEqual([
      {
        table: 'attendance_attempts',
        row: {
          session_id: 'session-1',
          registration_number: 'FUD/2022/001',
          reason: 'outside_hall',
        },
      },
    ]);
  });

  it('logs every one of the seven reasons', async () => {
    for (const reason of ATTEMPT_REASONS) {
      const { client, inserts } = fakeClient();
      await expect(
        logAttempt(client, 'session-1', 'FUD/2022/001', reason),
      ).resolves.toEqual({ ok: true });
      expect(inserts).toHaveLength(1);
      expect(inserts[0]?.row.reason).toBe(reason);
    }
  });

  it('an insert error is reported, never thrown — the refusal still stands', async () => {
    const { client, inserts } = fakeClient({ error: { message: 'relation does not exist' } });
    await expect(
      logAttempt(client, 'session-1', 'FUD/2022/001', 'already_submitted'),
    ).resolves.toEqual({ ok: false, message: 'relation does not exist' });
    // The row was still attempted — only the database said no.
    expect(inserts).toHaveLength(1);
  });

  it('a throwing client is reported, never thrown', async () => {
    const { client } = fakeClient({ throws: true });
    await expect(
      logAttempt(client, 'session-1', 'FUD/2022/001', 'selfie_missing'),
    ).resolves.toEqual({ ok: false, message: 'client exploded' });
  });
});
