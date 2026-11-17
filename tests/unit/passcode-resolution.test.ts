import { describe, expect, it } from 'vitest';
import {
  resolveActiveSessionByPasscode,
  type ActiveSessionRow,
  type PasscodeSessionQuery,
} from '../../supabase/functions/attendance-submit/resolveSession';

function makeRow(overrides: Partial<ActiveSessionRow> & { id: string }): ActiveSessionRow {
  return {
    course_id: 'course-1',
    status: 'active',
    qr_token_hash: null,
    qr_token_issued_at: '2026-11-16T10:00:00.000Z',
    passcode_hash: 'hash-1',
    qr_expires_in_seconds: 300,
    anchor_latitude: 11.1,
    anchor_longitude: 9.3,
    location_radius_meters: 30,
    ...overrides,
  };
}

type QueryResult = { data: ActiveSessionRow[] | null; error: { message: string } | null };

/**
 * Minimal fake of the Supabase query builder: records the `eq`
 * filters and applies them to in-memory rows when awaited. It proves
 * what the resolution query actually asks for — not just the
 * decision on canned rows.
 */
class FakeQuery {
  private filters: Array<{ column: string; value: unknown }> = [];

  constructor(
    private rows: ActiveSessionRow[],
    private forcedError: { message: string } | null = null,
  ) {}

  from(_table: string): this {
    return this;
  }

  select(_columns: string): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  get appliedFilters(): Array<{ column: string; value: unknown }> {
    return this.filters;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    if (this.forcedError) {
      return Promise.resolve({ data: null, error: this.forcedError }).then(
        onfulfilled,
        onrejected,
      );
    }
    const data = this.rows.filter((row) =>
      this.filters.every(
        (f) => (row as unknown as Record<string, unknown>)[f.column] === f.value,
      ),
    );
    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
  }
}

function fakeClient(rows: ActiveSessionRow[], error: { message: string } | null = null) {
  const query = new FakeQuery(rows, error);
  return {
    query,
    client: { from: () => query } as unknown as PasscodeSessionQuery,
  };
}

describe('resolveActiveSessionByPasscode', () => {
  it('resolves the single active session whose passcode hash matches', async () => {
    const { client } = fakeClient([
      makeRow({ id: 'other', passcode_hash: 'hash-2' }),
      makeRow({ id: 'target', passcode_hash: 'hash-1' }),
    ]);
    const result = await resolveActiveSessionByPasscode(client, 'hash-1');
    expect(result).toEqual({ ok: true, session: expect.objectContaining({ id: 'target' }) });
  });

  it('rejects with invalid_token when no session matches the passcode', async () => {
    const { client } = fakeClient([makeRow({ id: 's1', passcode_hash: 'hash-2' })]);
    const result = await resolveActiveSessionByPasscode(client, 'hash-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_token');
  });

  it('rejects with invalid_token when two active sessions share a passcode', async () => {
    const { client } = fakeClient([
      makeRow({ id: 's1', passcode_hash: 'hash-1' }),
      makeRow({ id: 's2', passcode_hash: 'hash-1' }),
    ]);
    const result = await resolveActiveSessionByPasscode(client, 'hash-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_token');
  });

  it('rejects a passcode that belongs only to a non-active session', async () => {
    const { client } = fakeClient([
      makeRow({ id: 'draft', status: 'draft', passcode_hash: 'hash-1' }),
      makeRow({ id: 'closed', status: 'closed', passcode_hash: 'hash-1' }),
    ]);
    const result = await resolveActiveSessionByPasscode(client, 'hash-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_token');
  });

  it('only ever queries active sessions, by the passcode hash', async () => {
    const { query, client } = fakeClient([makeRow({ id: 's1' })]);
    await resolveActiveSessionByPasscode(client, 'hash-1');
    expect(query.appliedFilters).toEqual([
      { column: 'status', value: 'active' },
      { column: 'passcode_hash', value: 'hash-1' },
    ]);
  });

  it('returns server_error when the lookup fails', async () => {
    const { client } = fakeClient([], { message: 'database down' });
    const result = await resolveActiveSessionByPasscode(client, 'hash-1');
    expect(result).toEqual({ ok: false, code: 'server_error', message: 'database down' });
  });
});
