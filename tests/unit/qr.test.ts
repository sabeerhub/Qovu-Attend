import { describe, expect, it } from 'vitest';
import {
  buildQrPayload,
  buildSubmitUrl,
  formatCountdown,
  generatePasscode,
  generateQrToken,
  isTokenExpired,
  isValidPasscode,
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

describe('classroom passcode validation', () => {
  it('accepts exactly six digits (and trims surrounding space)', () => {
    expect(isValidPasscode('123456')).toBe(true);
    expect(isValidPasscode(' 123456 ')).toBe(true);
    expect(isValidPasscode(generatePasscode())).toBe(true);
  });

  it('rejects anything that is not exactly six digits', () => {
    expect(isValidPasscode('')).toBe(false);
    expect(isValidPasscode('12345')).toBe(false);
    expect(isValidPasscode('1234567')).toBe(false);
    expect(isValidPasscode('12345a')).toBe(false);
    expect(isValidPasscode('abcdef')).toBe(false);
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
  it('encodes the public submission URL at the app root, not JSON', () => {
    const payload = buildQrPayload('https://uniattend.example', 'session-1', 'tok-abc');
    expect(payload).toBe('https://uniattend.example/?submit=session-1&token=tok-abc');
    expect(payload).not.toContain('{');
  });

  it('builds the public submission URL at the app root', () => {
    const url = buildSubmitUrl('https://uniattend.example', 'session-1', 'tok-abc');
    expect(url).toBe('https://uniattend.example/?submit=session-1&token=tok-abc');
  });

  it('round-trips a real generated token through the URL', () => {
    const token = generateQrToken();
    const payload = buildQrPayload('https://uniattend.example', 'session-1', token);
    const parsed = new URL(payload);
    expect(parsed.origin).toBe('https://uniattend.example');
    expect(parsed.pathname).toBe('/');
    expect(parsed.searchParams.get('submit')).toBe('session-1');
    expect(parsed.searchParams.get('token')).toBe(token);
  });

  it('survives URL-unsafe token characters (encoded, then decoded back)', () => {
    const token = 'Ab+C/dEf==';
    const payload = buildQrPayload('https://uniattend.example', 'session-1', token);
    expect(new URL(payload).searchParams.get('token')).toBe(token);
  });
});
