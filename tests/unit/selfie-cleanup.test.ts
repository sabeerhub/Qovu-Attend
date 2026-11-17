import { describe, expect, it } from 'vitest';
import {
  cleanupSessionSelfies,
  type SelfieRecordStore,
  type SelfieStorage,
} from '../../supabase/functions/session-transition/selfieCleanup';

type Calls = {
  listed: string[];
  removed: string[][];
  cleared: Array<{ table: string; values: Record<string, unknown>; column: string; value: unknown }>;
};

function fakeDeps(
  files: string[],
  failAt: 'list' | 'remove' | 'clear' | null = null,
): { storage: SelfieStorage; records: SelfieRecordStore; calls: Calls } {
  const calls: Calls = { listed: [], removed: [], cleared: [] };
  const storage: SelfieStorage = {
    list: async (prefix: string) => {
      calls.listed.push(prefix);
      if (failAt === 'list') return { data: null, error: { message: 'list boom' } };
      return { data: files.map((name) => ({ name })), error: null };
    },
    remove: async (paths: string[]) => {
      calls.removed.push(paths);
      if (failAt === 'remove') return { error: { message: 'remove boom' } };
      return { error: null };
    },
  };
  const records: SelfieRecordStore = {
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => ({
        eq: async (column: string, value: unknown) => {
          calls.cleared.push({ table, values, column, value });
          if (failAt === 'clear') return { error: { message: 'clear boom' } };
          return { error: null };
        },
      }),
    }),
  };
  return { storage, records, calls };
}

describe('cleanupSessionSelfies', () => {
  it('deletes the session photos and clears selfie_path on its records', async () => {
    const { storage, records, calls } = fakeDeps(['a.jpg', 'b.jpg']);
    await expect(cleanupSessionSelfies(storage, records, 's1')).resolves.toEqual({
      ok: true,
      deleted: 2,
    });
    expect(calls.listed).toEqual(['sessions/s1']);
    expect(calls.removed).toEqual([['sessions/s1/a.jpg', 'sessions/s1/b.jpg']]);
    expect(calls.cleared).toEqual([
      {
        table: 'attendance_records',
        values: { selfie_path: null },
        column: 'session_id',
        value: 's1',
      },
    ]);
  });

  it('still clears paths when the session has no photos', async () => {
    const { storage, records, calls } = fakeDeps([]);
    await expect(cleanupSessionSelfies(storage, records, 's1')).resolves.toEqual({
      ok: true,
      deleted: 0,
    });
    expect(calls.removed).toEqual([]);
    expect(calls.cleared).toHaveLength(1);
  });

  it('reports a list failure and deletes nothing', async () => {
    const { storage, records, calls } = fakeDeps(['a.jpg'], 'list');
    await expect(cleanupSessionSelfies(storage, records, 's1')).resolves.toEqual({
      ok: false,
      code: 'server_error',
      message: 'list boom',
      deleted: 0,
    });
    expect(calls.removed).toEqual([]);
    expect(calls.cleared).toEqual([]);
  });

  it('reports a remove failure and does not clear the paths', async () => {
    const { storage, records, calls } = fakeDeps(['a.jpg'], 'remove');
    await expect(cleanupSessionSelfies(storage, records, 's1')).resolves.toEqual({
      ok: false,
      code: 'server_error',
      message: 'remove boom',
      deleted: 0,
    });
    expect(calls.cleared).toEqual([]);
  });

  it('reports a clear failure honestly, with the photos already deleted', async () => {
    const { storage, records, calls } = fakeDeps(['a.jpg', 'b.jpg'], 'clear');
    await expect(cleanupSessionSelfies(storage, records, 's1')).resolves.toEqual({
      ok: false,
      code: 'server_error',
      message: 'clear boom',
      deleted: 2,
    });
    expect(calls.removed).toHaveLength(1);
  });
});
