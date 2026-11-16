import { describe, expect, it } from 'vitest';
import {
  isTokenWindowLive,
  validatePasscodeEntry,
  type ActiveSessionRow,
  type PasscodeSessionQuery,
} from '../../supabase/functions/attendance-submit/resolveSession';

// Issued 10:00:00, 300 s window → live 10:00:00–10:05:00 (exclusive).
const ISSUED_AT = '2026-11-16T10:00:00.000Z';
const NOW_IN_WINDOW = new Date('2026-11-16T10:02:00.000Z').getTime();
const NOW_AT_EXPIRY = new Date('2026-11-16T10:05:00.000Z').getTime();
const NOW_AFTER_EXPIRY = new Date('2026-11-16T10:06:00.000Z').getTime();

function makeRow(overrides: Partial<ActiveSessionRow> & { id: string }): ActiveSessionRow {
  return {
    status: 'active',
    qr_token_hash: null,
    qr_token_issued_at: ISSUED_AT,
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
 * Minimal fake of the Supabase query builder, same pattern as
 * passcode-resolution.test.ts: records the `eq` filters and applies
 * them to in-memory rows when awaited.
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

describe('validatePasscodeEntry — /submit code check (v0.5.5)', () => {
  it('validates a code for an active session inside its token window', async () => {
    const { client } = fakeClient([makeRow({ id: 's1' })]);
    const result = await validatePasscodeEntry(client, 'hash-1', NOW_IN_WINDOW);
    expect(result).toEqual({ ok: true });
  });

  it('rejects a wrong code with invalid_token', async () => {
    const { client } = fakeClient([makeRow({ id: 's1', passcode_hash: 'hash-2' })]);
    const result = await validatePasscodeEntry(client, 'hash-1', NOW_IN_WINDOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_token');
      // The answer never leaks which session (if any) the code
      // belongs to — no session id in the message.
      expect(result.message).not.toContain('s1');
    }
  });

  it('rejects a code whose token window has expired', async () => {
    const { client } = fakeClient([makeRow({ id: 's1' })]);
    const result = await validatePasscodeEntry(client, 'hash-1', NOW_AFTER_EXPIRY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_token');
  });

  it('rejects a code for a session with no token issue time', async () => {
    const { client } = fakeClient([makeRow({ id: 's1', qr_token_issued_at: null })]);
    const result = await validatePasscodeEntry(client, 'hash-1', NOW_IN_WINDOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_token');
  });

  it('rejects a code that belongs only to a non-active session', async () => {
    const { client } = fakeClient([
      makeRow({ id: 'draft', status: 'draft', passcode_hash: 'hash-1' }),
      makeRow({ id: 'closed', status: 'closed', passcode_hash: 'hash-1' }),
    ]);
    const result = await validatePasscodeEntry(client, 'hash-1', NOW_IN_WINDOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_token');
  });

  it('rejects when two active sessions share a code', async () => {
    const { client } = fakeClient([
      makeRow({ id: 's1', passcode_hash: 'hash-1' }),
      makeRow({ id: 's2', passcode_hash: 'hash-1' }),
    ]);
    const result = await validatePasscodeEntry(client, 'hash-1', NOW_IN_WINDOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_token');
  });

  it('rejects a code for an active in-window session with no anchor', async () => {
    // A session with no lecturer anchor refuses submissions until
    // closed and reopened, so its code must not validate as
    // "correct" — the student would be told it is right and then
    // fail at submission.
    const { client } = fakeClient([
      makeRow({ id: 's1', anchor_latitude: null, anchor_longitude: null }),
    ]);
    const result = await validatePasscodeEntry(client, 'hash-1', NOW_IN_WINDOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('invalid_token');
  });

  it('returns server_error when the lookup fails', async () => {
    const { client } = fakeClient([], { message: 'database down' });
    const result = await validatePasscodeEntry(client, 'hash-1', NOW_IN_WINDOW);
    expect(result).toEqual({ ok: false, code: 'server_error', message: 'database down' });
  });
});

describe('isTokenWindowLive', () => {
  it('is live inside the window and dead at exactly the expiry instant', () => {
    const row = makeRow({ id: 's1' });
    expect(isTokenWindowLive(row, NOW_IN_WINDOW)).toBe(true);
    expect(isTokenWindowLive(row, NOW_AT_EXPIRY)).toBe(false);
    expect(isTokenWindowLive(row, NOW_AFTER_EXPIRY)).toBe(false);
  });

  it('is dead without an issue time or with an unparseable one', () => {
    expect(isTokenWindowLive(makeRow({ id: 's1', qr_token_issued_at: null }), NOW_IN_WINDOW)).toBe(false);
    expect(
      isTokenWindowLive(makeRow({ id: 's1', qr_token_issued_at: 'not-a-date' }), NOW_IN_WINDOW),
    ).toBe(false);
  });
});
