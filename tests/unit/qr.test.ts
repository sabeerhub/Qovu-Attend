import { describe, expect, it } from 'vitest';
import {
  buildQrPayload,
  buildSubmitUrl,
  formatCountdown,
  generatePasscode,
  generateQrToken,
  isTokenExpired,
  parseQrPayload,
  tokenRemainingSeconds,
} from '@/lib/qr';

describe('QR token generation', () => {
  it('generates a 43-character base64url token (32 random bytes)', () => {
    const token = generateQrToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateQrToken()));
    expect(tokens.size).toBe(100);
  });

  it('generates a different token on every call (not a fixed or seeded value)', () => {
    expect(generateQrToken()).not.toBe(generateQrToken());
  });
});

describe('classroom passcode generation', () => {
  it('generates a 6-digit code with a non-zero first digit', () => {
    for (let i = 0; i < 50; i++) {
      const code = generatePasscode();
      expect(code).toMatch(/^[1-9][0-9]{5}$/);
    }
  });

  it('generates varying passcodes', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generatePasscode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('token expiry', () => {
  const issuedAt = new Date('2026-11-15T10:00:00.000Z');

  it('is not expired before the lifetime elapses', () => {
    expect(isTokenExpired(issuedAt, 300, new Date('2026-11-15T10:04:59.000Z'))).toBe(false);
  });

  it('is expired exactly at the boundary (issued + expires)', () => {
    expect(isTokenExpired(issuedAt, 300, new Date('2026-11-15T10:05:00.000Z'))).toBe(true);
  });

  it('is expired after the lifetime elapses', () => {
    expect(isTokenExpired(issuedAt, 300, new Date('2026-11-15T10:05:01.000Z'))).toBe(true);
  });

  it('accepts an ISO string issuedAt', () => {
    expect(isTokenExpired('2026-11-15T10:00:00.000Z', 60, new Date('2026-11-15T10:00:30.000Z'))).toBe(false);
    expect(isTokenExpired('2026-11-15T10:00:00.000Z', 60, new Date('2026-11-15T10:01:00.000Z'))).toBe(true);
  });

  it('treats an invalid issuedAt or non-positive lifetime as expired', () => {
    expect(isTokenExpired('not-a-date', 300)).toBe(true);
    expect(isTokenExpired(issuedAt, 0)).toBe(true);
    expect(isTokenExpired(issuedAt, -5)).toBe(true);
  });
});

describe('token remaining seconds', () => {
  const issuedAt = new Date('2026-11-15T10:00:00.000Z');

  it('returns the full lifetime at issuance', () => {
    expect(tokenRemainingSeconds(issuedAt, 300, issuedAt)).toBe(300);
  });

  it('counts down and never goes below 0', () => {
    expect(tokenRemainingSeconds(issuedAt, 300, new Date('2026-11-15T10:01:30.000Z'))).toBe(210);
    expect(tokenRemainingSeconds(issuedAt, 300, new Date('2026-11-15T10:05:00.000Z'))).toBe(0);
    expect(tokenRemainingSeconds(issuedAt, 300, new Date('2026-11-15T11:00:00.000Z'))).toBe(0);
  });
});

describe('countdown formatting', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatCountdown(300)).toBe('5:00');
    expect(formatCountdown(277)).toBe('4:37');
    expect(formatCountdown(59)).toBe('0:59');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-10)).toBe('0:00');
  });
});

describe('QR payload', () => {
  it('round-trips session id + token', () => {
    const payload = buildQrPayload('session-1', 'tok-abc');
    expect(parseQrPayload(payload)).toEqual({ v: 1, sessionId: 'session-1', token: 'tok-abc' });
  });

  it('rejects malformed or foreign payloads', () => {
    expect(parseQrPayload('not json')).toBeNull();
    expect(parseQrPayload('{"v":2,"sessionId":"s","token":"t"}')).toBeNull();
    expect(parseQrPayload('{"sessionId":"s"}')).toBeNull();
  });

  it('builds the public submission URL', () => {
    const url = buildSubmitUrl('https://uniattend.example', 'session-1', 'tok-abc');
    expect(url).toBe('https://uniattend.example/submit?submit=session-1&token=tok-abc');
  });
});
