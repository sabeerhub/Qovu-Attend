import { describe, expect, it } from 'vitest';
import {
  buildReportEmail,
  CONTACT_REPORT_FROM,
  CONTACT_REPORT_LOGO_PNG_URL,
  CONTACT_REPORT_RECIPIENT,
  escapeHtml,
  formatReceivedAt,
  isFreshReport,
  isValidReportId,
  topicLabel,
  type ContactReport,
} from '../../supabase/functions/contact-notify/email';

function makeReport(overrides: Partial<ContactReport> = {}): ContactReport {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    topic: 'problem',
    message: 'The sign-in button does nothing on my phone.',
    created_at: '2026-11-17T01:20:00.000Z',
    ...overrides,
  };
}

describe('contact-notify email', () => {
  it('builds the right subject line per topic', () => {
    expect(buildReportEmail(makeReport({ topic: 'problem' })).subject).toBe(
      'New Qovu report: Report a problem',
    );
    expect(buildReportEmail(makeReport({ topic: 'question' })).subject).toBe(
      'New Qovu report: Question',
    );
    expect(buildReportEmail(makeReport({ topic: 'feedback' })).subject).toBe(
      'New Qovu report: Feedback',
    );
  });

  it('sends from Qovu via Resend and to the owner by default', () => {
    const email = buildReportEmail(makeReport());
    expect(email.from).toBe(CONTACT_REPORT_FROM);
    expect(email.from).toBe('Qovu <onboarding@resend.dev>');
    expect(email.to).toBe(CONTACT_REPORT_RECIPIENT);
    expect(email.to).toBe('mustaphaabdulsalam1666@gmail.com');
  });

  it('lets the caller override the recipient', () => {
    const email = buildReportEmail(makeReport(), 'other@example.com');
    expect(email.to).toBe('other@example.com');
  });

  it('uses the PNG logo in the HTML — never an SVG, which email clients do not render', () => {
    const { html } = buildReportEmail(makeReport());
    expect(html).toContain(CONTACT_REPORT_LOGO_PNG_URL);
    expect(html).toContain('apple-touch-icon.png');
    expect(html).not.toContain('.svg');
    expect(html).not.toContain('logo.svg');
  });

  it('escapes user content in the HTML — a hostile message arrives as harmless text', () => {
    const hostile = makeReport({
      name: 'Eve <b>Bold</b>',
      email: 'eve@example.com',
      message: '<script>alert(1)</script> and <img src=x onerror=alert(1)>',
    });
    const { html } = buildReportEmail(hostile);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>Bold</b>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('Eve &lt;b&gt;Bold&lt;/b&gt;');
    // The plain-text part needs no escaping — it is not markup.
    expect(buildReportEmail(hostile).text).toContain(
      '<script>alert(1)</script> and <img src=x onerror=alert(1)>',
    );
  });

  it('escapes ampersands and quotes too', () => {
    expect(escapeHtml('Fish & Chips "quoted" \'single\' <tag>')).toBe(
      'Fish &amp; Chips &quot;quoted&quot; &#39;single&#39; &lt;tag&gt;',
    );
  });

  it('includes the reporter, the message in a canvas box, and the received time', () => {
    const { html, text } = buildReportEmail(makeReport());
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('ada@example.com');
    expect(html).toContain('The sign-in button does nothing on my phone.');
    expect(html).toContain('#f5f5f7');
    expect(html).toContain('2026-11-17 01:20 UTC');
    expect(html).toContain('Sent from Qovu &mdash; Attendance, verified.');
    expect(text).toContain('New Qovu report: Report a problem');
    expect(text).toContain('From: Ada Lovelace <ada@example.com>');
    expect(text).toContain('Received: 2026-11-17 01:20 UTC');
    expect(text).toContain('Sent from Qovu — Attendance, verified.');
  });

  it('formats the received time in one fixed UTC form', () => {
    expect(formatReceivedAt('2026-11-17T01:20:00.000Z')).toBe('2026-11-17 01:20 UTC');
    expect(formatReceivedAt('not-a-date')).toBe('not-a-date');
  });

  it('labels unknown topics as Report, never a blank subject', () => {
    expect(topicLabel('problem')).toBe('Report a problem');
    expect(topicLabel('question')).toBe('Question');
    expect(topicLabel('feedback')).toBe('Feedback');
    expect(topicLabel('anything-else')).toBe('Report');
    expect(buildReportEmail(makeReport({ topic: 'anything-else' })).subject).toBe(
      'New Qovu report: Report',
    );
  });
});

describe('contact-notify freshness (10-minute window)', () => {
  const NOW = Date.parse('2026-11-17T01:20:00.000Z');

  it('accepts a report 9 minutes old', () => {
    expect(isFreshReport('2026-11-17T01:11:00.000Z', NOW)).toBe(true);
  });

  it('refuses a report 11 minutes old', () => {
    expect(isFreshReport('2026-11-17T01:09:00.000Z', NOW)).toBe(false);
  });

  it('refuses a report exactly 10 minutes old — the window is under 10 minutes', () => {
    expect(isFreshReport('2026-11-17T01:10:00.000Z', NOW)).toBe(false);
  });

  it('accepts a report stamped slightly in the future (clock skew)', () => {
    expect(isFreshReport('2026-11-17T01:20:30.000Z', NOW)).toBe(true);
  });

  it('refuses a report stamped far in the future', () => {
    expect(isFreshReport('2026-11-17T01:25:00.000Z', NOW)).toBe(false);
  });

  it('refuses an unparseable date', () => {
    expect(isFreshReport('not-a-date', NOW)).toBe(false);
  });
});

describe('contact-notify report id validation', () => {
  it('accepts a UUID, upper- or lower-case', () => {
    expect(isValidReportId('11111111-2222-3333-4444-555555555555')).toBe(true);
    expect(isValidReportId('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE')).toBe(true);
  });

  it('refuses garbage, empty and non-string values', () => {
    expect(isValidReportId('not-a-uuid')).toBe(false);
    expect(isValidReportId('')).toBe(false);
    expect(isValidReportId('11111111-2222-3333-4444')).toBe(false);
    expect(isValidReportId(123)).toBe(false);
    expect(isValidReportId(null)).toBe(false);
    expect(isValidReportId(undefined)).toBe(false);
  });
});
