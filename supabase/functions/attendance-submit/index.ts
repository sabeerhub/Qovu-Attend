// attendance-submit — public student attendance submission (Phase 2,
// smart verification added Phase 4 v0.5.0).
//
// POST { sessionId?, registrationNumber, token?, passcode?, idempotencyKey,
//        latitude, longitude, accuracy?, deviceFingerprint }
// No student account and no Authorization header are required: the
// caller is authorized by the short-lived QR token (from scanning the
// lecturer's QR code) or the classroom passcode — at least one must be
// supplied. The client never submits a status; the server derives it.
//
// Since v0.5.4, `sessionId` may be omitted when a passcode is
// supplied (the /submit entry page): the server then resolves the
// session from SHA-256(passcode) among ACTIVE sessions — exactly
// one match, or `invalid_token` (see resolveSession.ts).
//
// Since v0.5.5 there is also a validate-only action for that entry
// page: POST { action: 'validate', passcode } checks the code the
// moment the student taps Continue — right code continues, wrong
// code is reported immediately. It resolves the session exactly as
// a submission does (exactly one ACTIVE session, same token-expiry
// window, anchor present) and answers valid/invalid only — never a
// session id or any detail. Because it is a brute-force oracle for
// a 6-digit code it is rate-limited strictly and separately from
// the submission limiter (60 attempts per client IP per minute,
// 2000 global per minute; see validateRateLimit.ts). Validation is
// NOT authorization: the full submission still re-verifies
// everything (session, expiry, location, device, duplicate) at
// submit time.
//
// Server-side checks, in order:
//   1. Session exists and status is 'active' (anything else: 409 session_not_active).
//      With no sessionId, the session is resolved from the passcode
//      hash first (zero or several matches: 401 invalid_token).
//   2. Credential: SHA-256(token) === qr_token_hash, or
//      SHA-256(passcode) === passcode_hash. Hashes are compared in
//      constant time in effect (fixed-length hex equality).
//   3. Expiry: now < qr_token_issued_at + qr_expires_in_seconds.
//      The client never decides expiry.
//   4. Registration number normalised (trim + uppercase).
//   5. Idempotency: a row with the same (session_id, idempotency_key)
//      is returned as-is (200, duplicate: true, retried: true).
//   6. Location (Phase 4): the submission MUST carry the student's
//      device coordinates. Missing/invalid coordinates are refused
//      (400 location_required) — there is no submission without a
//      location, and no fallback. The server computes the Haversine
//      distance from the session's lecturer anchor (captured at
//      activation) and rejects when it exceeds the session's
//      location_radius_meters (403 outside_location), or when the
//      reported accuracy is worse than 100 m (400
//      location_too_imprecise). The check applies identically to the
//      QR-token path and the passcode path. Client-side distance math
//      is display-only; the server decides. A session with no anchor
//      (activated before v0.5.0) refuses submissions until it is
//      closed and reopened (409 location_not_configured).
//   7. Device binding (Phase 4): the submission MUST carry the
//      SHA-256 device-fingerprint hash (64 hex chars; raw device
//      attributes never leave the phone). The first submission binds
//      the device to one registration number
//      (device_registrations, unique on the hash); a later
//      submission from the same device for a different registration
//      number is refused (403 device_bound_to_another_student).
//      One device may submit once per session (partial unique index
//      on (session_id, device_fingerprint_hash); a second attempt
//      maps to 409 device_already_used).
//   8. Uniqueness: the DB unique constraint on (session_id,
//      registration_number) is the backstop; a violation maps to
//      409 duplicate_registration (the student already submitted).
//   9. Record inserted with status 'verified' and verification_method
//      'qr' or 'passcode', derived server-side, plus the device
//      fingerprint hash.
//
// Rate limiting: a small in-memory per-session window (300 submissions
// per session per minute — a full lecture hall scanning at once).
// This is a best-effort guard for a single function instance — it is
// NOT a production-grade distributed rate limiter, and it resets
// when the instance is recycled. If abuse is a concern, put a
// managed limiter (e.g. Supabase rate limits / Cloudflare) in front
// of this function.
//
// Honest limits (see docs/SECURITY_MODEL.md): location and device
// checks are mitigations, not guarantees. GPS can be spoofed with
// mock-location apps, indoor GPS drifts, and a fingerprint is a
// hashed deterrent, not a proof of identity.
//
// UNTESTED: this function has not been run against a live Supabase
// project. Deploy to staging first and exercise the success /
// duplicate / expired / wrong-token paths before pilot.
// See docs/API_CONTRACTS.md for the request/response contract.

import {
  corsHeaders,
  createServiceClient,
  errorResponse,
  haversineMeters,
  isValidLatitude,
  isValidLongitude,
  jsonResponse,
  normalizeRegistrationNumber,
  sha256Hex,
} from '../_shared/server.ts';
import {
  resolveActiveSessionByPasscode,
  validatePasscodeEntry,
  type ActiveSessionRow,
  type PasscodeSessionQuery,
} from './resolveSession.ts';
import { createValidateRateLimiter } from './validateRateLimit.ts';

// --- Best-effort in-memory rate limit (see header note) ---
// 300 per session per minute: a full Nigerian lecture hall scanning
// the QR at once must not hit the limiter.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 300;

// A reported position less accurate than this is not trusted.
const MAX_LOCATION_ACCURACY_METERS = 100;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

// Validate-action limiter (v0.5.5): a brute-force oracle for a
// 6-digit code, so 60 attempts per client IP per minute and a
// 2000-per-minute global cap — far stricter than submissions.
const validateRateLimiter = createValidateRateLimiter();

/** First entry of `x-forwarded-for`, or 'unknown' when absent. */
function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (!forwarded) return 'unknown';
  const first = forwarded.split(',')[0]?.trim();
  return first || 'unknown';
}

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
  action?: unknown;
  sessionId?: unknown;
  registrationNumber?: unknown;
  token?: unknown;
  passcode?: unknown;
  idempotencyKey?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  deviceFingerprint?: unknown;
};

const FINGERPRINT_RE = /^[0-9a-f]{64}$/;
const PASSCODE_RE = /^\d{6}$/;

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

  let sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  const registrationNumber = typeof body.registrationNumber === 'string'
    ? normalizeRegistrationNumber(body.registrationNumber)
    : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const passcode = typeof body.passcode === 'string' ? body.passcode.trim() : '';

  // Validate-only action (v0.5.5): the /submit entry page checks
  // the code the moment the student taps Continue. This branch
  // runs before any submission validation and never writes
  // anything. It answers valid/invalid only — never a session id
  // or any detail — and the full submission still re-verifies
  // everything at submit time.
  if (action === 'validate') {
    if (validateRateLimiter.isLimited(clientIp(req))) {
      return errorResponse(
        'rate_limited',
        'Too many code checks. Wait a minute and try again.',
        429,
      );
    }
    if (!PASSCODE_RE.test(passcode)) {
      return errorResponse(
        'invalid_request',
        'A 6-digit classroom passcode is required.',
        400,
      );
    }
    let validateSupabase;
    try {
      validateSupabase = createServiceClient();
    } catch (err) {
      return errorResponse('not_configured', err instanceof Error ? err.message : 'Function not configured.', 500);
    }
    const passcodeHash = await sha256Hex(passcode);
    const validated = await validatePasscodeEntry(
      validateSupabase as unknown as PasscodeSessionQuery,
      passcodeHash,
    );
    if (!validated.ok) {
      return errorResponse(
        validated.code,
        validated.message,
        validated.code === 'server_error' ? 500 : 401,
      );
    }
    return jsonResponse({ ok: true, valid: true });
  }

  const idempotencyKey = typeof body.idempotencyKey === 'string'
    ? body.idempotencyKey.trim()
    : '';
  const latitude = body.latitude;
  const longitude = body.longitude;
  const accuracy = body.accuracy;
  const deviceFingerprint =
    typeof body.deviceFingerprint === 'string' ? body.deviceFingerprint.trim() : '';

  if (!sessionId && !passcode) {
    return errorResponse(
      'invalid_request',
      'sessionId is required unless a classroom passcode is supplied.',
      400,
    );
  }
  if (!registrationNumber) {
    return errorResponse('invalid_request', 'registrationNumber is required.', 400);
  }
  if (!token && !passcode) {
    return errorResponse('invalid_request', 'A QR token or classroom passcode is required.', 400);
  }
  // Location and device fingerprint are mandatory for every
  // submission (Phase 4). Validate the shapes here; the values are
  // checked against the session anchor below.
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    return errorResponse(
      'location_required',
      'Location is required to mark attendance. Turn on location services and try again.',
      400,
    );
  }
  if (
    accuracy !== null &&
    accuracy !== undefined &&
    !(typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0)
  ) {
    return errorResponse('invalid_request', 'accuracy must be a number of metres (0 or more) when supplied.', 400);
  }
  if (!FINGERPRINT_RE.test(deviceFingerprint)) {
    return errorResponse(
      'invalid_request',
      'A device fingerprint is required to mark attendance. Use a device and browser that support it.',
      400,
    );
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (err) {
    return errorResponse('not_configured', err instanceof Error ? err.message : 'Function not configured.', 500);
  }

  // 1. Session must exist and be active.
  // Passcode-only (v0.5.4): no session id — resolve exactly one
  // ACTIVE session from the passcode hash before anything else.
  // The lookup happens before the per-session rate limit here
  // because there is no session id to key the limiter on yet; the
  // limiter still runs on the resolved id below, before any write.
  let session: ActiveSessionRow | null = null;
  if (!sessionId) {
    const passcodeHash = await sha256Hex(passcode);
    const resolved = await resolveActiveSessionByPasscode(
      supabase as unknown as PasscodeSessionQuery,
      passcodeHash,
    );
    if (!resolved.ok) {
      return errorResponse(
        resolved.code,
        resolved.message,
        resolved.code === 'server_error' ? 500 : 401,
      );
    }
    session = resolved.session;
    sessionId = session.id;
  }

  if (isRateLimited(sessionId)) {
    return errorResponse(
      'rate_limited',
      'Too many submissions for this session. Wait a minute and try again.',
      429,
    );
  }

  if (!session) {
    const { data, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('id, status, qr_token_hash, qr_token_issued_at, passcode_hash, qr_expires_in_seconds, anchor_latitude, anchor_longitude, location_radius_meters')
      .eq('id', sessionId)
      .maybeSingle();
    if (sessionError) {
      return errorResponse('server_error', sessionError.message, 500);
    }
    if (!data) return errorResponse('session_not_found', 'No such attendance session.', 404);
    session = data as ActiveSessionRow;
  }
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

  // 6. Location (Phase 4): the server decides, from the lecturer
  //    anchor captured at activation. No anchor, no submission.
  const anchorLat = session.anchor_latitude as number | null;
  const anchorLon = session.anchor_longitude as number | null;
  if (
    anchorLat === null ||
    anchorLat === undefined ||
    anchorLon === null ||
    anchorLon === undefined
  ) {
    return errorResponse(
      'location_not_configured',
      'This session was started before location checks. Ask the lecturer to close and reopen it.',
      409,
    );
  }
  const reportedAccuracy =
    typeof accuracy === 'number' ? accuracy : null;
  if (reportedAccuracy !== null && reportedAccuracy > MAX_LOCATION_ACCURACY_METERS) {
    return errorResponse(
      'location_too_imprecise',
      'Your location is too imprecise to verify. Move somewhere with a clearer GPS signal and try again.',
      400,
    );
  }
  const radius = Number(session.location_radius_meters ?? 30);
  const distance = haversineMeters(
    { latitude: anchorLat, longitude: anchorLon },
    { latitude: latitude as number, longitude: longitude as number },
  );
  if (distance > radius) {
    return errorResponse(
      'outside_location',
      'You are too far from the lecture hall to submit attendance for this session.',
      403,
    );
  }

  // 7. Device binding (Phase 4): one device, one registration
  //    number. First submission binds the device; a later one for a
  //    different number is refused.
  const { data: binding, error: bindingError } = await supabase
    .from('device_registrations')
    .select('device_fingerprint_hash, registration_number')
    .eq('device_fingerprint_hash', deviceFingerprint)
    .maybeSingle();
  if (bindingError) {
    return errorResponse('server_error', bindingError.message, 500);
  }
  if (binding && binding.registration_number !== registrationNumber) {
    return errorResponse(
      'device_bound_to_another_student',
      'This device is already registered to another student. Use the device that belongs to this registration number.',
      403,
    );
  }
  if (!binding) {
    const { error: bindError } = await supabase.from('device_registrations').insert({
      device_fingerprint_hash: deviceFingerprint,
      registration_number: registrationNumber,
    });
    if (bindError) {
      // Race: another request bound this device first. Re-read; if
      // it is bound to someone else, refuse, otherwise proceed.
      if ((bindError as { code?: string }).code === '23505') {
        const { data: raced } = await supabase
          .from('device_registrations')
          .select('registration_number')
          .eq('device_fingerprint_hash', deviceFingerprint)
          .maybeSingle();
        if (raced && raced.registration_number !== registrationNumber) {
          return errorResponse(
            'device_bound_to_another_student',
            'This device is already registered to another student. Use the device that belongs to this registration number.',
            403,
          );
        }
      } else {
        return errorResponse('server_error', bindError.message, 500);
      }
    }
  }

  // 8 + 9. Insert; the unique constraints are the duplicate backstops.
  const { data: record, error: insertError } = await supabase
    .from('attendance_records')
    .insert({
      session_id: sessionId,
      registration_number: registrationNumber,
      status: 'verified',
      verification_method: verificationMethod,
      idempotency_key: idempotencyKey || null,
      device_fingerprint_hash: deviceFingerprint,
    })
    .select('id, session_id, registration_number, status, verification_method, submitted_at')
    .single();

  if (insertError) {
    // Postgres unique-violation (23505). Distinguish the two
    // backstops by constraint name: a device that already submitted
    // in this session, vs. a registration number that already did.
    const message = (insertError as { message?: string }).message ?? '';
    if (
      (insertError as { code?: string }).code === '23505' &&
      message.includes('attendance_records_session_device_unique')
    ) {
      return errorResponse(
        'device_already_used',
        'This device has already submitted attendance for this session.',
        409,
      );
    }
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
