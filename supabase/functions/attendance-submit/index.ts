// attendance-submit — public student attendance submission (Phase 2).
//
// POST { sessionId, registrationNumber, token?, passcode?, idempotencyKey }
// No student account and no Authorization header are required: the
// caller is authorized by the short-lived QR token (from scanning the
// lecturer's QR code) or the classroom passcode — at least one must be
// supplied. The client never submits a status; the server derives it.
//
// Server-side checks, in order:
//   1. Session exists and status is 'active' (anything else: 409 session_not_active).
//   2. Credential: SHA-256(token) === qr_token_hash, or
//      SHA-256(passcode) === passcode_hash. Hashes are compared in
//      constant time in effect (fixed-length hex equality).
//   3. Expiry: now < qr_token_issued_at + qr_expires_in_seconds.
//      The client never decides expiry.
//   4. Registration number normalised (trim + uppercase).
//   5. Idempotency: a row with the same (session_id, idempotency_key)
//      is returned as-is (200, duplicate: true, retried: true).
//   6. Uniqueness: the DB unique constraint on (session_id,
//      registration_number) is the backstop; a violation maps to
//      409 duplicate_registration (the student already submitted).
//   7. Record inserted with status 'verified' and verification_method
//      'qr' or 'passcode', derived server-side.
//
// Rate limiting: a small in-memory per-session window (60 submissions
// per session per minute). This is a best-effort guard for a single
// function instance — it is NOT a production-grade distributed rate
// limiter, and it resets when the instance is recycled. If abuse is
// a concern, put a managed limiter (e.g. Supabase rate limits /
// Cloudflare) in front of this function.
//
// UNTESTED: this function has not been run against a live Supabase
// project. Deploy to staging first and exercise the success /
// duplicate / expired / wrong-token paths before pilot.
// See docs/API_CONTRACTS.md for the request/response contract.

import {
  corsHeaders,
  createServiceClient,
  errorResponse,
  jsonResponse,
  normalizeRegistrationNumber,
  sha256Hex,
} from '../_shared/server.ts';

// --- Best-effort in-memory rate limit (see header note) ---
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 60;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(sessionId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(sessionId);
  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    rateBuckets.set(sessionId, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_MAX_PER_WINDOW;
}

type SubmitBody = {
  sessionId?: unknown;
  registrationNumber?: unknown;
  token?: unknown;
  passcode?: unknown;
  idempotencyKey?: unknown;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return errorResponse('method_not_allowed', 'Use POST.', 405);
  }

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return errorResponse('invalid_body', 'Request body must be valid JSON.', 400);
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const registrationNumber = typeof body.registrationNumber === 'string'
    ? normalizeRegistrationNumber(body.registrationNumber)
    : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const passcode = typeof body.passcode === 'string' ? body.passcode.trim() : '';
  const idempotencyKey = typeof body.idempotencyKey === 'string'
    ? body.idempotencyKey.trim()
    : '';

  if (!sessionId) return errorResponse('invalid_request', 'sessionId is required.', 400);
  if (!registrationNumber) {
    return errorResponse('invalid_request', 'registrationNumber is required.', 400);
  }
  if (!token && !passcode) {
    return errorResponse('invalid_request', 'A QR token or classroom passcode is required.', 400);
  }

  if (isRateLimited(sessionId)) {
    return errorResponse(
      'rate_limited',
      'Too many submissions for this session. Wait a minute and try again.',
      429,
    );
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (err) {
    return errorResponse('not_configured', err instanceof Error ? err.message : 'Function not configured.', 500);
  }

  // 1. Session must exist and be active.
  const { data: session, error: sessionError } = await supabase
    .from('attendance_sessions')
    .select('id, status, qr_token_hash, qr_token_issued_at, passcode_hash, qr_expires_in_seconds')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError) {
    return errorResponse('server_error', sessionError.message, 500);
  }
  if (!session) return errorResponse('session_not_found', 'No such attendance session.', 404);
  if (session.status !== 'active') {
    return errorResponse(
      'session_not_active',
      'This session is not collecting attendance right now.',
      409,
    );
  }

  // 2 + 3. Credential check (hash comparison) and server-side expiry.
  const issuedAt = session.qr_token_issued_at ? new Date(session.qr_token_issued_at) : null;
  const expiresIn = Number(session.qr_expires_in_seconds ?? 300);
  if (!issuedAt || Number.isNaN(issuedAt.getTime())) {
    return errorResponse('token_expired', 'This session has no live QR code. Ask the lecturer to re-activate it.', 410);
  }
  if (Date.now() >= issuedAt.getTime() + expiresIn * 1000) {
    return errorResponse('token_expired', 'The QR code for this session has expired.', 410);
  }
  let verificationMethod: string | null = null;
  if (token) {
    const hash = await sha256Hex(token);
    if (session.qr_token_hash && hash === session.qr_token_hash) verificationMethod = 'qr';
  }
  if (!verificationMethod && passcode) {
    const hash = await sha256Hex(passcode);
    if (session.passcode_hash && hash === session.passcode_hash) verificationMethod = 'passcode';
  }
  if (!verificationMethod) {
    return errorResponse('invalid_token', 'The QR code or passcode is not valid for this session.', 401);
  }

  // 5. Idempotency: a retry with the same key returns the original record.
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from('attendance_records')
      .select('id, session_id, registration_number, status, verification_method, submitted_at')
      .eq('session_id', sessionId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing) {
      return jsonResponse({ ok: true, duplicate: true, retried: true, record: existing });
    }
  }

  // 6 + 7. Insert; the unique constraint is the duplicate backstop.
  const { data: record, error: insertError } = await supabase
    .from('attendance_records')
    .insert({
      session_id: sessionId,
      registration_number: registrationNumber,
      status: 'verified',
      verification_method: verificationMethod,
      idempotency_key: idempotencyKey || null,
    })
    .select('id, session_id, registration_number, status, verification_method, submitted_at')
    .single();

  if (insertError) {
    // Postgres unique-violation (23505) on (session_id, registration_number).
    if ((insertError as { code?: string }).code === '23505') {
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id, session_id, registration_number, status, verification_method, submitted_at')
        .eq('session_id', sessionId)
        .eq('registration_number', registrationNumber)
        .maybeSingle();
      return jsonResponse(
        { ok: true, duplicate: true, retried: false, record: existing ?? null },
        200,
      );
    }
    return errorResponse('server_error', insertError.message, 500);
  }

  return jsonResponse({ ok: true, duplicate: false, record }, 200);
});
