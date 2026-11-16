// session-transition — lecturer session lifecycle transitions (Phase 2).
//
// POST { sessionId, to, reason?, anchor?, headcount? }
// Activation (to: 'active') requires anchor { latitude, longitude,
// accuracy? } — the lecturer's device location — and accepts an
// optional headcount (the physical count just taken, integer >= 0).
// Requires the lecturer's Supabase Auth JWT (Authorization: Bearer …).
// The caller must own the session (lecturer_profiles via auth.uid()
// matches attendance_sessions.lecturer_id); anything else is 403.
//
// Server-side transition table — this DUPLICATES the small table in
// src/lib/attendance.ts (canTransitionSession). Deno cannot import
// the frontend TS lib, so the table lives in both places; the single
// source of truth is the table in docs/ATTENDANCE_RULES.md, and both
// copies must be kept in step with it:
//   draft     -> active, archived
//   active    -> closed
//   closed    -> finalized, active (reopen, audit-logged)
//   finalized -> archived
//   archived  -> (terminal)
//
// Every transition writes an attendance_audit_logs row (action
// 'transition', previous/new status, reason, lecturer, timestamp).
//
// Activation (any transition TO 'active', draft→active or
// closed→active reopen): a fresh secure QR token + 6-digit classroom
// passcode are generated server-side with crypto.getRandomValues.
// Only their SHA-256 hashes (+ issued_at) are stored; the token and
// passcode are returned ONCE in this response. They cannot be
// recovered from the database afterwards — if the lecturer leaves the
// screen, close + reopen the session to issue a new code.
//
// Activation (Phase 4, v0.5.0) also REQUIRES the lecturer's device
// location (`anchor`: { latitude, longitude, accuracy? }): the
// lecturer's position at activation is the anchor that student
// submissions are checked against server-side. An activation
// without a usable anchor is refused (400 `anchor_required`) —
// there is no silent fallback and no activation without an anchor.
// The anchor is stored on the session with the capture time; the
// radius is the server-side default (30 m, column default).
//
// The lecturer may also confirm the physical headcount at
// activation (`headcount`: integer >= 0, taken in the hall just
// before projecting the QR). It is stored on the session; the
// headcount-vs-submissions flag in the monitor compares against
// this confirmed count. A headcount sent with a non-activation
// transition is ignored.
//
// Finalization (closed→finalized) marks records read-only for
// ordinary use: the frontend hides manual/correction controls and
// the manual-attendance function refuses finalized sessions.
//
// UNTESTED: this function has not been run against a live Supabase
// project. Deploy to staging first and exercise every transition
// (including illegal ones and a non-owner caller) before pilot.
// See docs/API_CONTRACTS.md for the request/response contract.

import {
  corsHeaders,
  createServiceClient,
  errorResponse,
  getCallerLecturerId,
  isValidLatitude,
  isValidLongitude,
  jsonResponse,
  sha256Hex,
} from '../_shared/server.ts';

type SessionStatus = 'draft' | 'active' | 'closed' | 'finalized' | 'archived';

// Single source of truth: docs/ATTENDANCE_RULES.md. Keep in step
// with src/lib/attendance.ts (canTransitionSession).
const ALLOWED_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  draft: ['active', 'archived'],
  active: ['closed'],
  closed: ['finalized', 'active'],
  finalized: ['archived'],
  archived: [],
};

function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

function secureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function securePasscode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const value = new DataView(bytes.buffer).getUint32(0, false);
  return String(100000 + (value % 900000));
}

type TransitionBody = {
  sessionId?: unknown;
  to?: unknown;
  reason?: unknown;
  anchor?: unknown;
  headcount?: unknown;
};

type AnchorInput = { latitude: number; longitude: number; accuracy: number | null };

/** Parse and validate the lecturer anchor. Null when it is missing or unusable. */
function parseAnchor(raw: unknown): AnchorInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const { latitude, longitude, accuracy } = raw as Record<string, unknown>;
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;
  const acc =
    accuracy === null || accuracy === undefined
      ? null
      : typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0
        ? accuracy
        : null;
  if (accuracy !== null && accuracy !== undefined && acc === null) return null;
  return { latitude, longitude, accuracy: acc };
}

/** Parse a headcount confirm: an integer >= 0, or null when absent/invalid. */
function parseHeadcount(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return errorResponse('method_not_allowed', 'Use POST.', 405);
  }

  let body: TransitionBody;
  try {
    body = (await req.json()) as TransitionBody;
  } catch {
    return errorResponse('invalid_body', 'Request body must be valid JSON.', 400);
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const to = typeof body.to === 'string' ? body.to.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : null;
  const validTargets: SessionStatus[] = ['draft', 'active', 'closed', 'finalized', 'archived'];
  if (!sessionId || !validTargets.includes(to as SessionStatus)) {
    return errorResponse('invalid_request', 'sessionId and a valid target status (to) are required.', 400);
  }
  const target = to as SessionStatus;
  // Activation needs the lecturer's location anchor — refuse
  // before any auth/ownership work is wasted on a doomed call.
  const anchor = target === 'active' ? parseAnchor(body.anchor) : null;
  if (target === 'active' && !anchor) {
    return errorResponse(
      'anchor_required',
      'Your location is required to start a session. Turn on location services, allow location for this site, and try again.',
      400,
    );
  }
  const confirmedHeadcount = target === 'active' ? parseHeadcount(body.headcount) : null;

  const lecturerId = await getCallerLecturerId(req);
  if (!lecturerId) {
    return errorResponse('unauthorized', 'Sign in as a lecturer to change a session.', 401);
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (err) {
    return errorResponse('not_configured', err instanceof Error ? err.message : 'Function not configured.', 500);
  }

  const { data: session, error: sessionError } = await supabase
    .from('attendance_sessions')
    .select('id, lecturer_id, status, qr_expires_in_seconds')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError) return errorResponse('server_error', sessionError.message, 500);
  if (!session) return errorResponse('session_not_found', 'No such attendance session.', 404);
  // Ownership: the caller must own the session. Never trust a
  // lecturer id supplied in the request body.
  if (session.lecturer_id !== lecturerId) {
    return errorResponse('forbidden', 'This session does not belong to you.', 403);
  }

  const from = session.status as SessionStatus;
  if (from === target) {
    return errorResponse('invalid_transition', `Session is already ${from}.`, 409);
  }
  if (!canTransition(from, target)) {
    return errorResponse(
      'invalid_transition',
      `Cannot move a session from ${from} to ${target}.`,
      409,
    );
  }

  // Activation issues a fresh token + passcode; only hashes are stored.
  // It also stores the lecturer's location anchor (required above)
  // and, when supplied, the confirmed physical headcount.
  let token: string | null = null;
  let passcode: string | null = null;
  const updates: Record<string, unknown> = { status: target, updated_at: new Date().toISOString() };
  if (target === 'active' && anchor) {
    token = secureToken();
    passcode = securePasscode();
    updates.qr_token_hash = await sha256Hex(token);
    updates.passcode_hash = await sha256Hex(passcode);
    updates.qr_token_issued_at = new Date().toISOString();
    updates.anchor_latitude = anchor.latitude;
    updates.anchor_longitude = anchor.longitude;
    updates.anchor_accuracy_meters = anchor.accuracy;
    updates.anchor_captured_at = new Date().toISOString();
    if (confirmedHeadcount !== null) updates.headcount = confirmedHeadcount;
  }

  const { data: updated, error: updateError } = await supabase
    .from('attendance_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select('id, status, headcount, qr_expires_in_seconds, qr_token_issued_at, anchor_latitude, anchor_longitude, anchor_accuracy_meters, anchor_captured_at, location_radius_meters, updated_at')
    .single();
  if (updateError || !updated) {
    return errorResponse('server_error', updateError?.message ?? 'Could not update the session.', 500);
  }

  const { error: auditError } = await supabase.from('attendance_audit_logs').insert({
    session_id: sessionId,
    record_id: null,
    lecturer_id: lecturerId,
    action: 'transition',
    previous_status: from,
    new_status: target,
    reason,
  });
  if (auditError) {
    // The transition already happened; report the audit failure
    // plainly rather than pretending everything is fine.
    return jsonResponse({
      ok: true,
      warning: 'Session moved, but the audit log entry could not be written: ' + auditError.message,
      session: updated,
      token,
      passcode,
    });
  }

  return jsonResponse({
    ok: true,
    session: updated,
    // Present ONLY on activation, and only in this response.
    token,
    passcode,
  });
});
