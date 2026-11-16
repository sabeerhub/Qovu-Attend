import { describe, expect, it } from 'vitest';
import { createValidateRateLimiter } from '../../supabase/functions/attendance-submit/validateRateLimit';

describe('createValidateRateLimiter — validate-action limits (v0.5.5)', () => {
  it('allows 60 attempts per IP per minute and limits the 61st', () => {
    const limiter = createValidateRateLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 60; i++) {
      expect(limiter.isLimited('203.0.113.7', t0 + i)).toBe(false);
    }
    expect(limiter.isLimited('203.0.113.7', t0 + 60)).toBe(true);
  });

  it('limits one IP without affecting another', () => {
    const limiter = createValidateRateLimiter();
    const t0 = 2_000_000;
    for (let i = 0; i < 61; i++) {
      limiter.isLimited('203.0.113.7', t0 + i);
    }
    expect(limiter.isLimited('203.0.113.7', t0 + 61)).toBe(true);
    expect(limiter.isLimited('198.51.100.9', t0 + 61)).toBe(false);
  });

  it('enforces the global cap across many IPs', () => {
    const limiter = createValidateRateLimiter({ maxGlobalPerWindow: 5 });
    const t0 = 3_000_000;
    for (let i = 0; i < 5; i++) {
      expect(limiter.isLimited(`203.0.113.${i + 1}`, t0 + i)).toBe(false);
    }
    expect(limiter.isLimited('203.0.113.99', t0 + 5)).toBe(true);
  });

  it('allows attempts again once the window passes', () => {
    const limiter = createValidateRateLimiter({ windowMs: 60_000 });
    const t0 = 4_000_000;
    for (let i = 0; i < 61; i++) {
      limiter.isLimited('203.0.113.7', t0 + i);
    }
    expect(limiter.isLimited('203.0.113.7', t0 + 61)).toBe(true);
    expect(limiter.isLimited('203.0.113.7', t0 + 60_001)).toBe(false);
  });

  it('treats a blank IP as the shared unknown bucket', () => {
    const limiter = createValidateRateLimiter();
    const t0 = 5_000_000;
    for (let i = 0; i < 60; i++) {
      expect(limiter.isLimited('   ', t0 + i)).toBe(false);
    }
    expect(limiter.isLimited('', t0 + 60)).toBe(true);
  });
});
