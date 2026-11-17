// Face (live selfie) check for attendance-submit (v0.10.0).
//
// The check is NOT face recognition and NOT identity proof: there
// are no student photos on file, so nothing can prove a face
// belongs to a registration number. All it does is catch the SAME
// face being used for two different numbers in one session.
//
//   - The client MUST send a live selfie (a small JPEG, base64)
//     and its 16-hex-char average hash (see src/lib/selfieHash.ts).
//     A submission without one is refused (`selfie_required`) —
//     there is no self-submission without a selfie. Students whose
//     phone has no front camera, or who cannot use the camera, are
//     added by hand by the lecturer (manual attendance), which is
//     the only fallback and needs no selfie.
//   - After the record is inserted, the server looks for another
//     record in the SAME session with the same hash but a DIFFERENT
//     registration number. A match sets `face_review` on BOTH
//     records — never a rejection, never a status change. The
//     lecturer reviews the flag in the session workspace.
//   - The same registration number re-submitting (idempotency) is
//     not a duplicate: the lookup excludes the submitting number.
//
// This module has no imports on purpose: it is the one piece of
// Edge Function logic that can be unit-tested under vitest (Deno
// is not installed in this workspace, and the shared server helpers
// import the Supabase client from a URL). The caller passes any
// object with the query-builder shape below — the real Supabase
// service client satisfies it at runtime.

// A 480px JPEG at quality 0.7 is typically 15–60 KB. 300,000
// base64 chars is about 225 KB of photo — far above any honest
// selfie, far below anything worth storing. Anything bigger is
// refused, not truncated.
const MAX_SELFIE_BASE64_CHARS = 300_000;
const MAX_SELFIE_BYTES = 225_000;
const SELFIE_HASH_RE = /^[0-9a-f]{16}$/;

/** A selfie hash is exactly 16 lowercase hex chars (64 bits). */
export function isValidSelfieHash(value: unknown): value is string {
  return typeof value === 'string' && SELFIE_HASH_RE.test(value);
}

export type SelfieInput =
  | { ok: true; present: true; bytes: Uint8Array; hash: string }
  | { ok: false; code: 'invalid_request' | 'selfie_required'; message: string };

/**
 * Validate the required selfie fields from the submission body.
 * A live selfie is compulsory for self-submission: a photo and
 * its hash must both be present, or the submission is refused
 * (`selfie_required`). A photo without its hash, or a hash without
 * its photo, is refused (`invalid_request`). A photo must be
 * base64, within the size cap, and start with the JPEG magic
 * bytes — anything else is not a photo from the capture step. A
 * hash must be 16 lowercase hex chars. Returns the decoded bytes
 * for the caller to store.
 */
export function parseSelfieInput(
  selfie: unknown,
  selfieHash: unknown,
): SelfieInput {
  const hasSelfie = typeof selfie === 'string' && selfie.length > 0;
  const hasHash = typeof selfieHash === 'string' && selfieHash.length > 0;
  if (!hasSelfie && !hasHash) {
    return {
      ok: false,
      code: 'selfie_required',
      message:
        'Take a live selfie to submit your attendance. If you have no front camera, ask your lecturer to add you.',
    };
  }
  if (!hasSelfie || !hasHash) {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'A selfie photo and its hash must be sent together.',
    };
  }
  if (!isValidSelfieHash(selfieHash)) {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'The selfie hash is not valid.',
    };
  }
  if (selfie.length > MAX_SELFIE_BASE64_CHARS) {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'The selfie photo is too large.',
    };
  }
  let bytes: Uint8Array;
  try {
    const binary = atob(selfie);
    bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'The selfie photo is not valid.',
    };
  }
  if (bytes.length === 0 || bytes.length > MAX_SELFIE_BYTES) {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'The selfie photo is too large.',
    };
  }
  // JPEG magic bytes (SOI marker). The capture step only ever
  // sends a JPEG from a canvas; anything else is not that photo.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'The selfie photo is not a JPEG image.',
    };
  }
  return { ok: true, present: true, bytes, hash: selfieHash };
}

export interface FaceCheckQuery {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: unknown,
      ) => {
        eq: (
          column: string,
          value: unknown,
        ) => {
          neq: (
            column: string,
            value: unknown,
          ) => PromiseLike<{
            data: Array<{ id: string; registration_number: string }> | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
    update: (values: Record<string, unknown>) => {
      in: (
        column: string,
        values: unknown[],
      ) => PromiseLike<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };
  };
}

export type FaceDuplicateResult =
  | { ok: true; duplicates: Array<{ id: string; registration_number: string }> }
  | { ok: false; code: 'server_error'; message: string };

/**
 * Records in this session that already carry this selfie hash for a
 * DIFFERENT registration number. The submitting number is excluded,
 * so a re-submission (idempotency) never flags itself. An empty
 * list means no match — the normal case.
 */
export async function findFaceDuplicates(
  client: FaceCheckQuery,
  sessionId: string,
  selfieHash: string,
  registrationNumber: string,
): Promise<FaceDuplicateResult> {
  const { data, error } = await client
    .from('attendance_records')
    .select('id, registration_number')
    .eq('session_id', sessionId)
    .eq('selfie_hash', selfieHash)
    .neq('registration_number', registrationNumber);
  if (error) {
    return { ok: false, code: 'server_error', message: error.message };
  }
  return { ok: true, duplicates: data ?? [] };
}

/**
 * Set the review flag on the given records. The flag is review
 * only: it changes no status and rejects nothing. The lecturer
 * clears it (confirm or dismiss) from the session workspace.
 */
export async function flagFaceReview(
  client: FaceCheckQuery,
  recordIds: string[],
): Promise<{ ok: true } | { ok: false; code: 'server_error'; message: string }> {
  if (recordIds.length === 0) return { ok: true };
  const { error } = await client
    .from('attendance_records')
    .update({ face_review: true })
    .in('id', recordIds);
  if (error) {
    return { ok: false, code: 'server_error', message: error.message };
  }
  return { ok: true };
}
