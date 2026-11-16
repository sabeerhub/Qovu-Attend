import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import {
  SPLASH_DURATION_MS,
  isSplashSkipKey,
  splashDurationMs,
  splashShouldSkip,
} from '@/lib/splash';
import { LogoSplash } from '@/components/brand/LogoSplash';

describe('logo splash timing (v0.8.1)', () => {
  it('plays for about seven seconds — inside the 6 to 10 second rule', () => {
    expect(SPLASH_DURATION_MS).toBe(7000);
    expect(SPLASH_DURATION_MS).toBeGreaterThanOrEqual(6000);
    expect(SPLASH_DURATION_MS).toBeLessThanOrEqual(10000);
    expect(splashDurationMs(false)).toBe(SPLASH_DURATION_MS);
  });

  it('skips entirely when the visitor prefers reduced motion', () => {
    expect(splashDurationMs(true)).toBe(0);
    expect(splashShouldSkip(true)).toBe(true);
    expect(splashShouldSkip(false)).toBe(false);
  });

  it('treats Escape — and only Escape — as a skip key', () => {
    expect(isSplashSkipKey('Escape')).toBe(true);
    for (const key of ['Enter', ' ', 'Tab', 'ArrowDown', 'a', '']) {
      expect(isSplashSkipKey(key)).toBe(false);
    }
  });

  it('renders the mark, the Qovu name, and the tap-to-skip hint', () => {
    const html = renderToString(createElement(LogoSplash, { onDone: () => {} }));
    expect(html).toContain('splash-screen');
    expect(html).toContain('splash-ring');
    expect(html).toContain('splash-dot');
    expect(html).toContain('Qovu');
    expect(html).toContain('Tap anywhere to continue');
  });
});
