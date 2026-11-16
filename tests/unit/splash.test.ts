import { describe, expect, it } from 'vitest';
import { SPLASH_DURATION_MS, splashDurationMs, splashShouldSkip } from '@/lib/splash';

describe('logo splash timing (v0.7.0)', () => {
  it('plays for about a second — never longer than 1.5 s', () => {
    expect(SPLASH_DURATION_MS).toBeGreaterThan(0);
    expect(SPLASH_DURATION_MS).toBeLessThanOrEqual(1500);
    expect(splashDurationMs(false)).toBe(SPLASH_DURATION_MS);
  });

  it('skips entirely when the visitor prefers reduced motion', () => {
    expect(splashDurationMs(true)).toBe(0);
    expect(splashShouldSkip(true)).toBe(true);
    expect(splashShouldSkip(false)).toBe(false);
  });
});
