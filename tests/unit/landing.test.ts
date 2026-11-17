import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { LandingPage } from '@/features/landing/LandingPage';
import { LandingIllustration } from '@/features/landing/LandingIllustration';
import {
  CodeIllustration,
  HallCheckIllustration,
  WeekPlanIllustration,
} from '@/features/landing/SectionIllustrations';

function renderLanding(): string {
  return renderToString(
    createElement(LandingPage, {
      onSignIn: () => {},
      onSignUp: () => {},
      onContact: () => {},
      onPrivacy: () => {},
      onTerms: () => {},
    }),
  );
}

describe('landing page rebuild (v0.8.2) — Apple scroll story', () => {
  it('has exactly one hero heading and the two account buttons', () => {
    const html = renderLanding();
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).toContain('Attendance, verified.');
    expect(html).toContain('Create account');
    expect(html).toContain('Sign in');
  });

  it('tells the story in three sections, one idea each', () => {
    const html = renderLanding();
    expect(html).toContain('Show the code.');
    expect(html).toContain('Only the hall counts.');
    expect(html).toContain('Your week, planned.');
    expect(html).toContain('Ready when your next lecture starts.');
  });

  it('has a real footer with Contact, Privacy and Terms links', () => {
    const html = renderLanding();
    expect(html).toContain('Contact us');
    expect(html).toContain('Privacy Policy');
    expect(html).toContain('Terms &amp; Conditions');
  });

  it('shows the cartoons — hero plus one per section — and nothing else decorative', () => {
    const html = renderLanding();
    expect(html).toContain('A lecturer showing a QR code and students scanning it');
    expect(html).toContain('A projector screen showing a QR code and a six-digit code');
    expect(html).toContain('A circle showing the thirty metre area around the lecturer');
    expect(html).toContain('A week from Monday to Saturday with one block for each planned lecture');
    expect(html).not.toContain('animate-spin');
    expect(html).not.toContain('gradient');
  });

  it('renders the story content visible by default (scroll reveal never hides it)', () => {
    const html = renderLanding();
    expect(html).toContain('reveal reveal-visible');
    expect(html).toContain('Show the code.');
  });

  it('has no leftover crowded features strip or filler', () => {
    const html = renderLanding();
    expect(html).not.toContain('How it works');
    expect(html).not.toContain('Built against cheating');
    expect(html).not.toContain('Headcount cross-check');
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

describe('scroll-story illustrations (v0.8.2)', () => {
  it.each([
    ['code', CodeIllustration],
    ['hall check', HallCheckIllustration],
    ['week plan', WeekPlanIllustration],
  ] as const)('%s is a single inline SVG with exactly one accent-blue element', (_name, Component) => {
    const html = renderToString(createElement(Component));
    expect(html).toContain('<svg');
    expect(html).toContain('#111111');
    expect((html.match(/#0071e3/g) ?? []).length).toBe(1);
    expect(html).not.toContain('gradient');
  });
});
