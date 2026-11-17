import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { PrivacyPage } from '@/features/legal/PrivacyPage';
import { TermsPage } from '@/features/legal/TermsPage';
import { ContactPage } from '@/features/contact/ContactPage';
import type { PublicPageNav } from '@/components/layout/PublicPageLayout';

const NAV: PublicPageNav = {
  onHome: () => {},
  onSignIn: () => {},
  onSignUp: () => {},
  onContact: () => {},
  onPrivacy: () => {},
  onTerms: () => {},
};

describe('privacy policy (v0.8.2) — real content, no placeholders', () => {
  const html = renderToString(createElement(PrivacyPage, { nav: NAV }));

  it('states what is collected, in plain words', () => {
    expect(html).toContain('What we collect');
    expect(html).toContain('registration number');
    expect(html).toContain('30 metres');
    expect(html).toContain('hash');
    expect(html).toContain('headcount');
  });

  it('states who can see data and that it is never sold', () => {
    expect(html).toContain('Who can see it');
    expect(html).toContain('do not sell data');
  });

  it('is honest about the limits of the checks', () => {
    expect(html).toContain('Honest limits');
    expect(html).toContain('never treated as proof of cheating');
  });

  it('has no placeholder text', () => {
    expect(html.toLowerCase()).not.toContain('lorem');
    expect(html.toLowerCase()).not.toContain('placeholder');
    expect(html).toContain('Last updated: 17 November 2026');
  });
});

describe('terms & conditions (v0.8.2) — real content, no placeholders', () => {
  const html = renderToString(createElement(TermsPage, { nav: NAV }));

  it('covers lecturers, students and the limits of the service', () => {
    expect(html).toContain('Your responsibilities as a lecturer');
    expect(html).toContain('Rules for students');
    expect(html).toContain('What Qovu does not promise');
    expect(html).toContain('Finalised records');
  });

  it('has no placeholder text', () => {
    expect(html.toLowerCase()).not.toContain('lorem');
    expect(html.toLowerCase()).not.toContain('placeholder');
    expect(html).toContain('Last updated: 17 November 2026');
  });
});

describe('contact page (v0.8.2)', () => {
  const html = renderToString(createElement(ContactPage, { nav: NAV }));

  it('shows the real form: name, email, topic, message', () => {
    expect(html).toContain('Contact us');
    expect(html).toContain('Your name');
    expect(html).toContain('Email');
    expect(html).toContain('Report a problem');
    expect(html).toContain('Question');
    expect(html).toContain('Feedback');
    expect(html).toContain('Message');
    expect(html).toContain('Send report');
  });

  it('has no placeholder text', () => {
    expect(html.toLowerCase()).not.toContain('lorem');
  });
});
