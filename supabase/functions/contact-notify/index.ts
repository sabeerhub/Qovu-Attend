// contact-notify — premium email for one contact report (v0.8.3).
//
// POST { reportId } — called by the contact form AFTER the report
// is saved (the report save never depends on this call).
//
// The function re-reads the report row server-side by id (the
// client is never trusted for name / email / message) and sends one
// premium HTML + plain-text email via Resend to the owner.
//
// Server-side checks, in order:
//   1. Body is valid JSON with a UUID reportId (anything else:
//      400 invalid_request, nothing sent).
//   2. RESEND_API_KEY is configured (missing: 500 not_configured,
//      nothing sent, no stack trace).
//   3. The report row exists (missing: 404 not_found, nothing sent).
//   4. Freshness: the row must be under 10 minutes old (older:
//      410 report_too_old, nothing sent). A replayed id from hours
//      ago can never trigger an email.
//   5. One email per report id per function instance (best-effort
//      in-memory set — the same honesty note as the other
//      in-memory guards in this codebase: it resets when the
//      instance is recycled, and it is NOT a production-grade
//      distributed dedup. A replayed call returns the original
//      Resend id with duplicate: true and sends nothing new).
//
// Failures are logged server-side and answered with a clear error
// JSON — never a stack trace. The Resend API key lives only in the
// Edge Function environment (Supabase dashboard secret, set by the
// owner); the recipient comes from the CONTACT_REPORT_EMAIL secret
// when set, otherwise the default in email.ts.
// See docs/API_CONTRACTS.md for the request/response contract.

import {
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
} from '../_shared/server.ts';
import {
  buildReportEmail,
  CONTACT_REPORT_FRESHNESS_MS,
  CONTACT_REPORT_RECIPIENT,
  isFreshReport,
  isValidReportId,
  RESEND_API_URL,
  type ContactReport,
} from './email.ts';

// Best-effort per-instance dedup (see header note): report id ->
// Resend message id of the email already sent for it. Capped so
// the map cannot grow without bound; the oldest entry is dropped.
const MAX_SENT_IDS = 1000;
const sentByReportId = new Map<string, string>();

type NotifyBody = {
  reportId?: unknown;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return errorResponse('method_not_allowed', 'Use POST.', 405);
  }

  let body: NotifyBody;
  try {
    body = (await req.json()) as NotifyBody;
  } catch {
    return errorResponse('invalid_body', 'Request body must be valid JSON.', 400);
  }

  const reportId = typeof body.reportId === 'string' ? body.reportId.trim() : '';
  if (!isValidReportId(reportId)) {
    return errorResponse(
      'invalid_request',
      'A report id (UUID) is required.',
      400,
    );
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('contact-notify: RESEND_API_KEY is not configured.');
    return errorResponse(
      'not_configured',
      'The report email service is not configured.',
      500,
    );
  }
  const recipient = Deno.env.get('CONTACT_REPORT_EMAIL') || CONTACT_REPORT_RECIPIENT;

  // A replayed call for a report that already emailed: answer with
  // the original Resend id and send nothing new.
  const alreadySentId = sentByReportId.get(reportId);
  if (alreadySentId) {
    return jsonResponse({ ok: true, sent: true, id: alreadySentId, duplicate: true });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (err) {
    return errorResponse(
      'not_configured',
      err instanceof Error ? err.message : 'Function not configured.',
      500,
    );
  }

  // Re-read the row server-side — the client supplies only the id.
  let report: ContactReport | null = null;
  try {
    const { data, error: fetchError } = await supabase
      .from('contact_reports')
      .select('id, name, email, topic, message, created_at')
      .eq('id', reportId)
      .maybeSingle();
    if (fetchError) {
      console.error('contact-notify: failed to read report row.', fetchError.message);
      return errorResponse('server_error', 'The report could not be read.', 500);
    }
    report = data as ContactReport | null;
  } catch (err) {
    console.error('contact-notify: failed to read report row.', err);
    return errorResponse('server_error', 'The report could not be read.', 500);
  }
  if (!report) {
    return errorResponse('not_found', 'No such report.', 404);
  }

  if (!isFreshReport(report.created_at)) {
    return errorResponse(
      'report_too_old',
      `This report is older than ${CONTACT_REPORT_FRESHNESS_MS / 60_000} minutes and can no longer trigger an email.`,
      410,
    );
  }

  const email = buildReportEmail(report, recipient);

  let resendResponse: Response;
  try {
    resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
  } catch (err) {
    console.error('contact-notify: could not reach Resend.', err);
    return errorResponse('email_failed', 'The report email could not be sent.', 502);
  }

  let resendBody: unknown = null;
  try {
    resendBody = await resendResponse.json();
  } catch {
    resendBody = null;
  }
  if (!resendResponse.ok) {
    const detail =
      resendBody && typeof resendBody === 'object' && 'message' in resendBody
        ? String((resendBody as { message: unknown }).message)
        : `Resend returned HTTP ${resendResponse.status}.`;
    console.error('contact-notify: Resend refused the email.', detail);
    return errorResponse('email_failed', 'The report email could not be sent.', 502);
  }
  const resendId =
    resendBody && typeof resendBody === 'object' && typeof (resendBody as { id?: unknown }).id === 'string'
      ? (resendBody as { id: string }).id
      : '';

  if (sentByReportId.size >= MAX_SENT_IDS) {
    const oldest = sentByReportId.keys().next().value as string | undefined;
    if (oldest) sentByReportId.delete(oldest);
  }
  sentByReportId.set(reportId, resendId);

  return jsonResponse({ ok: true, sent: true, id: resendId });
});
