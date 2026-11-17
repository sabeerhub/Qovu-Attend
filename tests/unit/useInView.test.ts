import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { resolveInitialInView, revealClassName } from '@/lib/useInView';
import { Reveal } from '@/components/ui/reveal';

describe('resolveInitialInView — scroll reveal safety (v0.8.2)', () => {
  it('starts hidden only when a working observer exists and motion is allowed', () => {
    expect(resolveInitialInView({ observerAvailable: true, reducedMotion: false })).toBe(false);
  });

  it('starts visible when there is no observer to animate with', () => {
    expect(resolveInitialInView({ observerAvailable: false, reducedMotion: false })).toBe(true);
  });

  it('starts visible when the visitor prefers reduced motion', () => {
    expect(resolveInitialInView({ observerAvailable: true, reducedMotion: true })).toBe(true);
    expect(resolveInitialInView({ observerAvailable: false, reducedMotion: true })).toBe(true);
  });
});

describe('revealClassName', () => {
  it('maps the in-view state to the reveal classes', () => {
    expect(revealClassName(false)).toBe('reveal');
    expect(revealClassName(true)).toBe('reveal reveal-visible');
  });
});

describe('Reveal — server render (v0.8.2)', () => {
  it('renders children visible by default, never hidden', () => {
    const html = renderToString(createElement(Reveal, null, 'Story section'));
    expect(html).toContain('Story section');
    expect(html).toContain('reveal reveal-visible');
  });
});
