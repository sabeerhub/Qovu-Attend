// Contact report email (v0.8.3) — pure module, no imports on purpose:
// it is unit-testable under vitest (Deno is not installed in this
// workspace, and the shared server helpers import the Supabase
// client from a URL). The Edge Function imports this file; the
// caller passes plain data. Nothing here touches the network or
// any secret — the Resend call lives in index.ts.

/** One row of `contact_reports` (v0.8.2 migration), as the server re-reads it. */
export interface ContactReport {
  id: string;
  name: string;
  email: string;
  /** 'problem' | 'question' | 'feedback' — enforced by the DB CHECK. */
  topic: string;
  message: string;
  /** ISO 8601 timestamp. */
  created_at: string;
}

/** Where report emails go. Overridable in the function by the CONTACT_REPORT_EMAIL secret. */
export const CONTACT_REPORT_RECIPIENT = 'mustaphaabdulsalam1666@gmail.com';

/**
 * Resend free-tier sender — no custom domain yet, so the mail comes
 * from Qovu via Resend's onboarding address until Qovu has its own
 * domain. The display name is what the inbox shows.
 */
export const CONTACT_REPORT_FROM = 'Qovu <onboarding@resend.dev>';

export const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Header image for the email. Gmail and most email clients do NOT
 * render SVG images, so this is the PNG logo (the real Q mark,
 * 180x180) — never logo.svg.
 */
export const CONTACT_REPORT_LOGO_PNG_URL =
  'https://uniattend-x.vercel.app/apple-touch-icon.png';

/**
 * Freshness window (anti-replay/spam): a report id only triggers
 * an email while the report is this young. Older rows are refused
 * outright — a replayed id from hours ago sends nothing.
 */
export const CONTACT_REPORT_FRESHNESS_MS = 10 * 60 * 1000;

export const CONTACT_REPORT_TOPIC_LABELS: Record<string, string> = {
  problem: 'Report a problem',
  question: 'Question',
  feedback: 'Feedback',
};

/** Plain label for a topic value; unknown values fall back to 'Report'. */
export function topicLabel(topic: string): string {
  return CONTACT_REPORT_TOPIC_LABELS[topic] ?? 'Report';
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the value is a UUID string (the only shape a report id ever has). */
export function isValidReportId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/**
 * Escape text for the HTML email. EVERY user value (name, email,
 * message) goes through this before it is placed in the HTML, so a
 * report containing markup arrives as harmless text, never as
 * markup. The plain-text part needs no escaping.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * True when the report was created within the freshness window
 * (and not in the future, allowing for a small clock skew of up to
 * 60 seconds — a row stamped slightly ahead still counts as fresh).
 * Unparseable dates are never fresh.
 */
export function isFreshReport(createdAt: string, nowMs: number = Date.now()): boolean {
  const createdMs = Date.parse(createdAt);
  if (Number.isNaN(createdMs)) return false;
  const ageMs = nowMs - createdMs;
  return ageMs >= -60_000 && ageMs < CONTACT_REPORT_FRESHNESS_MS;
}

/** Received time in one fixed, readable form (UTC, no locale dependence). */
export function formatReceivedAt(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;
  return `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

export interface ReportEmail {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Premium HTML + plain-text email for one report. Layout: 600px
 * centred container, white background, ink text, one accent blue
 * (#0071e3) — the same palette as the product. Header with the PNG
 * Qovu logo and wordmark, an accent-blue topic badge, the
 * reporter's name and email, the message inside a canvas #f5f5f7
 * box, the received time, and a small footer.
 */
export function buildReportEmail(
  report: ContactReport,
  recipient: string = CONTACT_REPORT_RECIPIENT,
): ReportEmail {
  const label = topicLabel(report.topic);
  const subject = `New Qovu report: ${label}`;
  const received = formatReceivedAt(report.created_at);
  const safeName = escapeHtml(report.name);
  const safeEmail = escapeHtml(report.email);
  const safeMessage = escapeHtml(report.message);

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111111;">
    <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e5e5e5;border-radius:12px;">
        <tr>
          <td style="padding:28px 28px 8px 28px;">
            <img src="${CONTACT_REPORT_LOGO_PNG_URL}" alt="Qovu" width="40" height="40" style="display:block;border-radius:10px;" />
            <p style="margin:12px 0 0 0;font-size:20px;font-weight:700;color:#111111;">Qovu</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 0 28px;">
            <span style="display:inline-block;background-color:#0071e3;color:#ffffff;font-size:13px;font-weight:600;padding:4px 10px;border-radius:999px;">${escapeHtml(label)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 0 28px;">
            <p style="margin:0;font-size:15px;line-height:1.6;color:#111111;">From <strong>${safeName}</strong> &lt;${safeEmail}&gt;</p>
            <p style="margin:4px 0 0 0;font-size:13px;line-height:1.5;color:#6e6e73;">Received ${escapeHtml(received)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 0 28px;">
            <div style="background-color:#f5f5f7;border-radius:8px;padding:16px;font-size:15px;line-height:1.6;color:#111111;white-space:pre-wrap;">${safeMessage}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 28px 28px;">
            <p style="margin:0;font-size:13px;line-height:1.5;color:#6e6e73;">Sent from Qovu &mdash; Attendance, verified.</p>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;

  const text = `New Qovu report: ${label}

From: ${report.name} <${report.email}>
Received: ${received}

Message:
${report.message}

Sent from Qovu — Attendance, verified.`;

  return { from: CONTACT_REPORT_FROM, to: recipient, subject, html, text };
}
