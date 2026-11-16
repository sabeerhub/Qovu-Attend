import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { LandingPage } from '@/features/landing/LandingPage';
import { LandingIllustration } from '@/features/landing/LandingIllustration';

function renderLanding(): string {
  return renderToString(
    createElement(LandingPage, { onSignIn: () => {}, onSignUp: () => {} }),
  );
}

describe('landing page rebuild (v0.8.1)', () => {
  it('has exactly one hero heading and the two account buttons', () => {
    const html = renderLanding();
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).toContain('Attendance, verified.');
    expect(html).toContain('Create account');
    expect(html).toContain('Sign in');
  });

  it('shows the three how-it-works steps in plain words', () => {
    const html = renderLanding();
    expect(html).toContain('The lecturer starts a session');
    expect(html).toContain('Students mark themselves present');
    expect(html).toContain('Qovu checks they are really there');
  });

  it('keeps the features to one quiet strip, no boxes or filler', () => {
    const html = renderLanding();
    expect(html).toContain('30 m location check');
    expect(html).toContain('One device per student');
    expect(html).toContain('Headcount cross-check');
    expect(html).not.toContain('Built against cheating');
  });

  it('shows the one small cartoon and nothing else decorative', () => {
    const html = renderLanding();
    expect(html).toContain('A lecturer showing a QR code and students scanning it');
    expect(html).not.toContain('animate-spin');
    expect(html).not.toContain('gradient');
  });
});

describe('landing illustration (v0.8.1)', () => {
  it('is a single inline SVG in ink with one accent-blue square', () => {
    const html = renderToString(createElement(LandingIllustration));
    expect(html).toContain('<svg');
    expect(html).toContain('#111111');
    expect((html.match(/#0071e3/g) ?? []).length).toBe(1);
    expect(html).not.toContain('gradient');
  });
});
