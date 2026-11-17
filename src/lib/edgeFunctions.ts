/**
 * Typed client for the Phase 2 Edge Functions (docs/API_CONTRACTS.md).
 *
 * All attendance writes go through these functions because the client
 * has NO insert/update policy on attendance_records or
 * attendance_audit_logs. Calls use plain fetch against
 * `<your Supabase project URL>/functions/v1/<name>` so the server's error body
 * ({ ok, error: { code, message } }) and HTTP status survive intact.
 *
 * When Supabase is not configured, every call returns
 * `{ ok: false, unavailable: true }` and the UI renders the honest
 * "unavailable without a live backend" state — never a fake result.
 */

import { isSupabaseConfigured, supabase, supabaseConfig } from './supabase';
import type { GeoCoords } from './geo';
import type { AttendanceRecord, AttendanceRecordStatus, SessionStatus } from '@/types/database';

export interface EdgeError {
  code: string;
  message: string;
}

export type EdgeResult<T> =
  | { ok: true; data: T }
  | { ok: false; unavailable: boolean; error: EdgeError; status?: number };

export function unavailableResult<T>(message: string): EdgeResult<T> {
  return {
    ok: false,
    unavailable: true,
    error: { code: 'not_configured', message },
  };
}

const NOT_CONFIGURED_MESSAGE =
  'Attendance operations need a live backend. Supabase is not connected yet.';

async function callFunction<T>(
  name: string,
  body: unknown,
  options: { auth: boolean },
): Promise<EdgeResult<T>> {
  if (!isSupabaseConfigured || !supabaseConfig) {
    return unavailableResult<T>(NOT_CONFIGURED_MESSAGE);
  }
  let accessToken: string | null = null;
  if (options.auth) {
    if (!supabase) return unavailableResult<T>(NOT_CONFIGURED_MESSAGE);
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token ?? null;
    if (!accessToken) {
      return {
        ok: false,
        unavailable: false,
        error: { code: 'unauthorized', message: 'Sign in as a lecturer to do this.' },
        status: 401,
      };
    }
  }
  let response: Response;
  try {
    response = await fetch(`${supabaseConfig.url}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${accessToken ?? supabaseConfig.anonKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    return {
      ok: false,
      unavailable: true,
      error: {
        code: 'unreachable',
        message:
          err instanceof Error
            ? `Could not reach the attendance service: ${err.message}`
            : 'Could not reach the attendance service.',
      },
    };
  }
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  // The server's error body ({ ok, error: { code, message } }) is
  // authoritative whenever it parses — including on 4xx, where the
  // code (e.g. token_expired, invalid_transition) is the useful part.
  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      unavailable: response.status >= 500,
      error: {
        code: 'server_error',
        message: `The attendance service returned HTTP ${response.status}.`,
      },
      status: response.status,
    };
  }
  const payload = parsed as { ok?: unknown; error?: EdgeError; [key: string]: unknown };
  if (payload.ok !== true) {
    return {
      ok: false,
      unavailable: response.status >= 500,
      error: payload.error ?? { code: 'server_error', message: 'The attendance service returned an error.' },
      status: response.status,
    };
  }
  return { ok: true, data: payload as unknown as T };
}

// ------------------------------------------------------------------ types

export interface TransitionResponse {
  ok: true;
  warning?: string;
  session: {
    id: string;
    status: SessionStatus;
    headcount: number | null;
    qr_expires_in_seconds: number;
    qr_token_issued_at: string | null;
    anchor_latitude: number | null;
    anchor_longitude: number | null;
    anchor_accuracy_meters: number | null;
    anchor_captured_at: string | null;
    location_radius_meters: number;
  };
  /** Present only on activation, and only in this response. */
  token: string | null;
  passcode: string | null;
}

export interface SubmitResponse {
  ok: true;
  duplicate: boolean;
  retried: boolean;
  record: AttendanceRecord | null;
  /** True when the same face was used for another number in this session (flagged for lecturer review). */
  faceReview?: boolean;
  /** The attendance stands; something secondary (face check, flagging) could not run. */
  warning?: string;
}

export interface ManualResponse {
  ok: true;
  warning?: string;
  record: AttendanceRecord;
}

export interface BulkMarkResponse {
  ok: true;
  /** Students newly marked as arrived. */
  marked: number;
  /** Students skipped because they already had a record. */
  skipped: number;
  /** Students that could not be marked. */
  failed: number;
  /** Registration numbers that could not be marked, for the plain-language report. */
  failedNumbers: string[];
  /** The attendance stands; something secondary (the audit log) could not be written. */
  warning?: string;
}

export interface ValidatePasscodeResponse {
  ok: true;
  valid: true;
}

// ------------------------------------------------------------------ calls

export interface TransitionOptions {
  reason?: string;
  /**
   * Lecturer anchor (Phase 4): the lecturer's device location at
   * activation. Required by the server for any transition TO
   * 'active'; ignored otherwise.
   */
  anchor?: GeoCoords;
  /**
   * Confirmed physical headcount (Phase 4): the count just taken in
   * the hall. Sent only with activation; ignored otherwise.
   */
  headcount?: number;
}

/** Move a session between lifecycle states (lecturer, authenticated). */
export function transitionSession(
  sessionId: string,
  to: SessionStatus,
  options?: TransitionOptions,
): Promise<EdgeResult<TransitionResponse>> {
  return callFunction<TransitionResponse>(
    'session-transition',
    {
      sessionId,
      to,
      reason: options?.reason ?? undefined,
      anchor: options?.anchor ?? undefined,
      headcount: options?.headcount ?? undefined,
    },
    { auth: true },
  );
}

export interface SubmitAttendanceInput {
  /**
   * The session, when the student arrived from a QR link. Optional
   * since v0.5.4: a student who entered the classroom passcode on
   * the /submit entry page has no session id — the server resolves
   * the session from the passcode hash instead.
   */
  sessionId?: string;
  registrationNumber: string;
  token?: string;
  passcode?: string;
  idempotencyKey: string;
  /**
   * Phase 4 — mandatory student location. The server rejects the
   * submission without coordinates, beyond the session radius, or
   * with accuracy worse than 100 m.
   */
  latitude: number;
  longitude: number;
  /** Reported accuracy in metres, or null when the device gives none. */
  accuracy: number | null;
  /**
   * Phase 4 — SHA-256 device-fingerprint hash (64 hex chars). Only
   * the hash is ever sent; raw device attributes never leave the phone.
   */
  deviceFingerprint: string;
  /**
   * Face check (v0.10.0) — compulsory live selfie. The JPEG bytes
   * (base64) and the 16-hex-char average hash of the frame. Both
   * are always sent; the server refuses a submission without them
   * (`selfie_required`). Students without a front camera are added
   * by hand by the lecturer instead.
   */
  selfie?: string;
  selfieHash?: string;
}

/** Public student submission — no auth. At least one of token / passcode is required. */
export function submitAttendance(
  input: SubmitAttendanceInput,
): Promise<EdgeResult<SubmitResponse>> {
  return callFunction<SubmitResponse>('attendance-submit', input, { auth: false });
}

/**
 * Validate-only code check for the /submit entry page (v0.5.5) —
 * no auth. The server checks the 6-digit code the moment the
 * student taps Continue and answers valid/invalid only; it never
 * returns a session id or any detail. Validation is NOT
 * authorization: the full submission still re-verifies everything
 * at submit time.
 */
export function validatePasscode(
  passcode: string,
): Promise<EdgeResult<ValidatePasscodeResponse>> {
  return callFunction<ValidatePasscodeResponse>(
    'attendance-submit',
    { action: 'validate', passcode },
    { auth: false },
  );
}

export interface NotifyContactReportResponse {
  ok: true;
  sent: true;
  id: string;
  duplicate?: boolean;
}

/**
 * Ask the server to email one saved contact report to the owner
 * (v0.8.3) — no auth. The function re-reads the report by id and
 * sends the premium email via Resend. Fire-and-forget from the
 * contact form: the email must never fail the report.
 */
export function notifyContactReport(
  reportId: string,
): Promise<EdgeResult<NotifyContactReportResponse>> {
  return callFunction<NotifyContactReportResponse>(
    'contact-notify',
    { reportId },
    { auth: false },
  );
}

/** Lecturer manual add (registration number + reason, both required). */
export function manualAdd(
  sessionId: string,
  registrationNumber: string,
  reason: string,
): Promise<EdgeResult<ManualResponse>> {
  return callFunction<ManualResponse>(
    'manual-attendance',
    { sessionId, registrationNumber, reason },
    { auth: true },
  );
}

/** Lecturer correction of one record's status (reason required). */
export function correctRecord(
  sessionId: string,
  recordId: string,
  newStatus: AttendanceRecordStatus,
  reason: string,
): Promise<EdgeResult<ManualResponse>> {
  return callFunction<ManualResponse>(
    'manual-attendance',
    { sessionId, recordId, newStatus, reason },
    { auth: true },
  );
}

/**
 * Lecturer face review (v0.10.0): confirm or dismiss a
 * `face_review` flag on one record (reason required).
 * - 'confirm': the lecturer agrees the same face was used for two
 *   numbers — the record becomes 'suspicious' and the flag clears.
 * - 'dismiss': the lecturer checked and it is fine — the status
 *   stays as it was and the flag clears.
 * Either way the decision is written to the audit log.
 */
export function reviewFace(
  sessionId: string,
  recordId: string,
  faceReview: 'confirm' | 'dismiss',
  reason: string,
): Promise<EdgeResult<ManualResponse>> {
  return callFunction<ManualResponse>(
    'manual-attendance',
    { sessionId, recordId, faceReview, reason },
    { auth: true },
  );
}

/**
 * Lecturer bulk mark all as arrived (v0.12.0): one tap marks
 * every student on the course's class list as manual attendance.
 * The server re-reads the list and skips anyone who already has a
 * record in this session — nobody is ever counted twice, and a
 * second run marks nobody new. The shared reason is stored on
 * every new record and in the audit log, like a single manual add.
 * The response counts marked / skipped / failed, so a partial
 * failure is never a silent half-result.
 */
export function bulkMarkAll(
  sessionId: string,
  reason: string,
): Promise<EdgeResult<BulkMarkResponse>> {
  return callFunction<BulkMarkResponse>(
    'manual-attendance',
    { sessionId, bulkMarkAll: true, reason },
    { auth: true },
  );
}

// ------------------------------------------------------- public submit URL

export interface SubmitParams {
  sessionId: string;
  token: string | null;
}

/**
 * The public submission route (documented in docs/API_CONTRACTS.md):
 * `?submit=<sessionId>&token=<token>`. The token comes from the QR
 * code; without it the student enters the classroom passcode instead.
 * Nothing else about the session is exposed to the public page.
 */
export function getSubmitParams(search: string): SubmitParams | null {
  const params = new URLSearchParams(search);
  const sessionId = params.get('submit');
  if (!sessionId) return null;
  return { sessionId, token: params.get('token') };
}

export type SubmitRoute =
  | { kind: 'session'; params: SubmitParams }
  | { kind: 'entry' };

/**
 * Which public submission view the current URL is (v0.5.4):
 * - `session` — a QR link (`?submit=<sessionId>&token=<token>`, on
 *   any path) or the same params on `/submit`: the attendance form.
 * - `entry` — `/submit` with no session params: the passcode entry
 *   page for students who cannot scan the QR code.
 * - `null` — any other page: the lecturer portal.
 */
export function getSubmitRoute(pathname: string, search: string): SubmitRoute | null {
  const params = getSubmitParams(search);
  if (params) return { kind: 'session', params };
  if (pathname === '/submit') return { kind: 'entry' };
  return null;
}
