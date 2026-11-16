import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Supabase module so the Edge Function client thinks a
// project is configured. No live backend is involved; fetch is stubbed.
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabaseConfig: { url: 'https://test.supabase.co', anonKey: 'anon-test-key' },
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'lecturer-jwt' } },
      }),
    },
  },
}));

import { correctRecord, manualAdd, submitAttendance, transitionSession, validatePasscode } from '@/lib/edgeFunctions';

type StubResponse = { status: number; body: unknown };

let nextResponse: StubResponse = { status: 200, body: { ok: true } };
const fetchCalls: Array<{ url: string; init: RequestInit }> = [];

function stubFetch(response: StubResponse) {
  nextResponse = response;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchCalls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      fetchCalls.push({ url, init });
      return jsonResponse(nextResponse.body, nextResponse.status);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('session-transition client', () => {
  it('activates a draft and returns the once-only token + passcode', async () => {
    stubFetch({
      status: 200,
      body: {
        ok: true,
        session: {
          id: 's1',
          status: 'active',
          qr_expires_in_seconds: 300,
          qr_token_issued_at: '2026-11-15T10:00:00.000Z',
        },
        token: 'tok-abc',
        passcode: '123456',
      },
    });
    const result = await transitionSession('s1', 'active');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.token).toBe('tok-abc');
      expect(result.data.passcode).toBe('123456');
      expect(result.data.session.status).toBe('active');
    }
    expect(fetchCalls[0].url).toBe('https://test.supabase.co/functions/v1/session-transition');
    expect(JSON.parse(String(fetchCalls[0].init.body))).toEqual({
      sessionId: 's1',
      to: 'active',
    });
    // Lecturer calls carry the lecturer JWT, never the anon key alone.
    expect(fetchCalls[0].init.headers).toMatchObject({ Authorization: 'Bearer lecturer-jwt' });
  });

  it('sends the lecturer anchor and confirmed headcount on activation', async () => {
    stubFetch({
      status: 200,
      body: {
        ok: true,
        session: {
          id: 's1',
          status: 'active',
          headcount: 42,
          qr_expires_in_seconds: 300,
          qr_token_issued_at: '2026-11-15T10:00:00.000Z',
          anchor_latitude: 11.123,
          anchor_longitude: 8.456,
          anchor_accuracy_meters: 12,
          anchor_captured_at: '2026-11-15T10:00:00.000Z',
          location_radius_meters: 50,
        },
        token: 'tok-abc',
        passcode: '123456',
      },
    });
    const result = await transitionSession('s1', 'active', {
      anchor: { latitude: 11.123, longitude: 8.456, accuracy: 12 },
      headcount: 42,
    });
    expect(result.ok).toBe(true);
    expect(JSON.parse(String(fetchCalls[0].init.body))).toEqual({
      sessionId: 's1',
      to: 'active',
      anchor: { latitude: 11.123, longitude: 8.456, accuracy: 12 },
      headcount: 42,
    });
  });

  it('maps an illegal transition (409) to its server code and message', async () => {
    stubFetch({
      status: 409,
      body: {
        ok: false,
        error: { code: 'invalid_transition', message: 'Cannot move a session from draft to closed.' },
      },
    });
    const result = await transitionSession('s1', 'closed');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_transition');
      expect(result.error.message).toMatch(/draft to closed/);
      expect(result.status).toBe(409);
    }
  });

  it('reports an unreachable backend as unavailable, not as a fake result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));
    const result = await transitionSession('s1', 'active');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailable).toBe(true);
      expect(result.error.code).toBe('unreachable');
    }
  });
});

describe('attendance-submit client', () => {
  const input = {
    sessionId: 's1',
    registrationNumber: 'FUT/2022/001',
    token: 'tok-abc',
    idempotencyKey: 'sub-s1-FUT/2022/001',
    latitude: 11.123456,
    longitude: 8.123456,
    accuracy: 12,
    deviceFingerprint: 'a'.repeat(64),
  };

  it('sends location and device fingerprint with the submission', async () => {
    stubFetch({
      status: 200,
      body: {
        ok: true,
        duplicate: false,
        retried: false,
        record: {
          id: 'r1',
          session_id: 's1',
          registration_number: 'FUT/2022/001',
          status: 'verified',
          verification_method: 'qr',
          submitted_at: '2026-11-15T10:01:00.000Z',
        },
      },
    });
    const result = await submitAttendance(input);
    expect(result.ok).toBe(true);
    expect(JSON.parse(String(fetchCalls[0].init.body))).toMatchObject({
      latitude: 11.123456,
      longitude: 8.123456,
      accuracy: 12,
      deviceFingerprint: 'a'.repeat(64),
    });
  });

  it('submits without auth and returns the record', async () => {
    stubFetch({
      status: 200,
      body: {
        ok: true,
        duplicate: false,
        retried: false,
        record: {
          id: 'r1',
          session_id: 's1',
          registration_number: 'FUT/2022/001',
          status: 'verified',
          verification_method: 'qr',
          submitted_at: '2026-11-15T10:01:00.000Z',
        },
      },
    });
    const result = await submitAttendance(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.duplicate).toBe(false);
      expect(result.data.record?.status).toBe('verified');
    }
    // Public submission uses the anon key, not a lecturer session.
    expect(fetchCalls[0].init.headers).toMatchObject({ Authorization: 'Bearer anon-test-key' });
  });

  it('maps a duplicate submission to duplicate: true instead of an error', async () => {
    stubFetch({
      status: 200,
      body: {
        ok: true,
        duplicate: true,
        retried: false,
        record: {
          id: 'r1',
          session_id: 's1',
          registration_number: 'FUT/2022/001',
          status: 'verified',
          verification_method: 'qr',
          submitted_at: '2026-11-15T10:01:00.000Z',
        },
      },
    });
    const result = await submitAttendance(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.duplicate).toBe(true);
  });

  it('maps an expired token (410) to its server code', async () => {
    stubFetch({
      status: 410,
      body: {
        ok: false,
        error: { code: 'token_expired', message: 'The QR code for this session has expired.' },
      },
    });
    const result = await submitAttendance(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('token_expired');
      expect(result.status).toBe(410);
    }
  });

  it('omits sessionId and sends only the passcode for the /submit entry flow (v0.5.4)', async () => {
    stubFetch({
      status: 200,
      body: {
        ok: true,
        duplicate: false,
        retried: false,
        record: {
          id: 'r1',
          session_id: 's1',
          registration_number: 'FUT/2022/001',
          status: 'verified',
          verification_method: 'passcode',
          submitted_at: '2026-11-15T10:01:00.000Z',
        },
      },
    });
    const result = await submitAttendance({
      registrationNumber: 'FUT/2022/001',
      passcode: '123456',
      idempotencyKey: 'attempt-abc',
      latitude: 11.123456,
      longitude: 8.123456,
      accuracy: 12,
      deviceFingerprint: 'a'.repeat(64),
    });
    expect(result.ok).toBe(true);
    const body = JSON.parse(String(fetchCalls[0].init.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty('sessionId');
    expect(body).toMatchObject({ passcode: '123456' });
  });
});

describe('manual-attendance client', () => {
  it('sends a manual add with registration number + reason', async () => {
    stubFetch({
      status: 200,
      body: {
        ok: true,
        record: {
          id: 'r2',
          session_id: 's1',
          registration_number: 'FUT/2022/009',
          status: 'manual',
          verification_method: 'manual',
          manual_reason: 'No phone',
          submitted_at: '2026-11-15T10:02:00.000Z',
        },
      },
    });
    const result = await manualAdd('s1', 'FUT/2022/009', 'No phone');
    expect(result.ok).toBe(true);
    expect(JSON.parse(String(fetchCalls[0].init.body))).toEqual({
      sessionId: 's1',
      registrationNumber: 'FUT/2022/009',
      reason: 'No phone',
    });
    expect(fetchCalls[0].url).toBe('https://test.supabase.co/functions/v1/manual-attendance');
  });

  it('sends a correction with record id + new status + reason', async () => {
    stubFetch({
      status: 200,
      body: {
        ok: true,
        record: {
          id: 'r1',
          session_id: 's1',
          registration_number: 'FUT/2022/001',
          status: 'rejected',
          verification_method: 'qr',
          submitted_at: '2026-11-15T10:01:00.000Z',
        },
      },
    });
    const result = await correctRecord('s1', 'r1', 'rejected', 'Wrong student');
    expect(result.ok).toBe(true);
    expect(JSON.parse(String(fetchCalls[0].init.body))).toEqual({
      sessionId: 's1',
      recordId: 'r1',
      newStatus: 'rejected',
      reason: 'Wrong student',
    });
  });

  it('maps a finalized-session refusal (409) to its server code', async () => {
    stubFetch({
      status: 409,
      body: {
        ok: false,
        error: { code: 'session_read_only', message: 'This session is finalized and read-only.' },
      },
    });
    const result = await manualAdd('s1', 'FUT/2022/009', 'No phone');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('session_read_only');
  });
});

describe('validatePasscode client — /submit code check (v0.5.5)', () => {
  it('sends a validate action with only the passcode, no auth', async () => {
    stubFetch({ status: 200, body: { ok: true, valid: true } });
    const result = await validatePasscode('123456');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.valid).toBe(true);
    expect(fetchCalls[0].url).toBe('https://test.supabase.co/functions/v1/attendance-submit');
    expect(JSON.parse(String(fetchCalls[0].init.body))).toEqual({
      action: 'validate',
      passcode: '123456',
    });
    // Public call: the anon key, never a lecturer JWT.
    expect(fetchCalls[0].init.headers).toMatchObject({ Authorization: 'Bearer anon-test-key' });
  });

  it('maps a wrong code (401 invalid_token) to its server code', async () => {
    stubFetch({
      status: 401,
      body: {
        ok: false,
        error: { code: 'invalid_token', message: 'The passcode is not valid for a live session right now.' },
      },
    });
    const result = await validatePasscode('999999');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_token');
      expect(result.status).toBe(401);
    }
  });

  it('maps a rate-limited check (429) to its server code', async () => {
    stubFetch({
      status: 429,
      body: {
        ok: false,
        error: { code: 'rate_limited', message: 'Too many code checks. Wait a minute and try again.' },
      },
    });
    const result = await validatePasscode('123456');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('rate_limited');
      expect(result.status).toBe(429);
    }
  });
});
