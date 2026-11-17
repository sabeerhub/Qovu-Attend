// Refused-tries log for attendance-submit (v0.16.0).
//
// The gap (owner-reported, verified in code): when a submission
// was refused — second submission, device already used, device
// registered to another number, outside the hall, location too
// imprecise, number not on the class list, no selfie — the block
// worked, but nothing was ever written anywhere. The session
// monitor only reads attendance_records, so the lecturer saw
// nothing. This helper is the trace: one row per logged refusal
// in `attendance_attempts` (who, why, when).
//
// Logged refusals — exactly these seven, and nothing else:
//   - already_submitted: a retried submission (idempotency hit),
//     or the (session_id, registration_number) unique-constraint
//     backstop when a student submits again without the same key.
//   - device_already_used: the device already submitted in this
//     session (the (session_id, device_fingerprint_hash) unique
//     backstop).
//   - device_registered_to_other: the device is bound to a
//     different registration number.
//   - outside_hall: the student is further than the session's
//     30 m radius from the lecturer anchor.
//   - location_imprecise: the reported accuracy is worse than
//     100 m.
//   - not_on_class_list: the number is not on a non-empty class
//     list for the session's course.
//   - selfie_missing: the submission carries no selfie at all
//     (`selfie_required`).
//
// Deliberately NOT logged: wrong-passcode guesses from the
// `validate` action (no registration number there, and they are
// rate-limited probes — logging them would flood the table);
// malformed selfie input (`invalid_request` — a photo without its
// hash, a non-JPEG, an oversized photo); session/token problems
// (`session_not_active`, `invalid_token`, `token_expired`,
// `location_not_configured`); rate limits; missing-field requests.
//
// Logging is best-effort and can never change a refusal: if the
// insert fails (for example the migration has not been applied
// yet), the original refusal response still stands. This helper
// never throws — it catches everything and reports the failure,
// and the caller ignores the result and returns the refusal.
//
// No device data is stored here at all — not even a hash. The
// registration number is normalized (trim + uppercase) the same
// way records are.
//
// This module has no imports on purpose: it is the one piece of
// Edge Function logic that can be unit-tested under vitest (Deno
// is not installed in this workspace, and the shared server
// helpers import the Supabase client from a URL). The caller
// passes any object with the query-builder shape below — the real
// Supabase service client satisfies it at runtime.

/** The seven logged refusal reasons — kept in sync with the
 *  CHECK constraint on `attendance_attempts.reason`. */
export const ATTEMPT_REASONS = [
  'already_submitted',
  'device_already_used',
  'device_registered_to_other',
  'outside_hall',
  'location_imprecise',
  'not_on_class_list',
  'selfie_missing',
] as const;

export type AttemptReason = (typeof ATTEMPT_REASONS)[number];

export interface AttemptLogQuery {
  from: (table: string) => {
    insert: (row: {
      session_id: string;
      registration_number: string;
      reason: AttemptReason;
    }) => PromiseLike<{ error: { message: string } | null }>;
  };
}

export type AttemptLogResult =
  | { ok: true }
  | { ok: false; message: string };

/** Canonical registration-number form: trim + uppercase, the
 *  same normalization records use. */
export function normalizeAttemptRegNo(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Write one refused-try row. Never throws: any failure (a missing
 * table, a database error, a client that misbehaves) is reported
 * as `{ ok: false }` and the caller returns the original refusal
 * unchanged — logging must never break a refusal.
 */
export async function logAttempt(
  client: AttemptLogQuery,
  sessionId: string,
  registrationNumber: string,
  reason: AttemptReason,
): Promise<AttemptLogResult> {
  try {
    const { error } = await client.from('attendance_attempts').insert({
      session_id: sessionId,
      registration_number: normalizeAttemptRegNo(registrationNumber),
      reason,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Could not log the refused try.',
    };
  }
}
