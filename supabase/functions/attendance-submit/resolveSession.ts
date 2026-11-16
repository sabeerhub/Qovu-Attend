// Passcode-only session resolution for attendance-submit (v0.5.4).
//
// A student on the /submit entry page has no session id — only the
// 6-digit classroom passcode. The server finds the session by
// SHA-256(passcode) among ACTIVE sessions. Exactly one match must
// exist; zero or more than one is the same `invalid_token` answer —
// the caller is never told how many matched, and a passcode is
// never accepted for a Draft / Closed / Finalized / Archived
// session (the query only ever sees `status = 'active'`).
//
// This module has no imports on purpose: it is the one piece of
// Edge Function logic that can be unit-tested under vitest (Deno
// is not installed in this workspace, and the shared server helpers
// import the Supabase client from a URL). The caller passes any
// object with the query-builder shape below — the real Supabase
// service client satisfies it at runtime.
//
// Known limit: there is no index on `passcode_hash`
// (see supabase/migrations/20261115010000_session_qr_tokens.sql),
// so the lookup scans `attendance_sessions`. That table holds one
// row per lecture session and stays small; no migration was added
// for this slice.

export interface ActiveSessionRow {
  id: string;
  status: string;
  qr_token_hash: string | null;
  qr_token_issued_at: string | null;
  passcode_hash: string | null;
  qr_expires_in_seconds: number | null;
  anchor_latitude: number | null;
  anchor_longitude: number | null;
  location_radius_meters: number | null;
}

/** The only query-builder shape this module needs. */
export interface PasscodeSessionQuery {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: unknown,
      ) => {
        eq: (
          column: string,
          value: unknown,
        ) => PromiseLike<{
          data: ActiveSessionRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
}

export type ResolveSessionResult =
  | { ok: true; session: ActiveSessionRow }
  | { ok: false; code: 'invalid_token' | 'server_error'; message: string };

export const PASSCODE_SESSION_COLUMNS =
  'id, status, qr_token_hash, qr_token_issued_at, passcode_hash, qr_expires_in_seconds, anchor_latitude, anchor_longitude, location_radius_meters';

/**
 * Find the one active session whose passcode hash matches. The
 * hash is compared by the database equality on the stored hash —
 * the plaintext passcode is never stored or logged.
 */
export async function resolveActiveSessionByPasscode(
  client: PasscodeSessionQuery,
  passcodeHash: string,
): Promise<ResolveSessionResult> {
  const { data, error } = await client
    .from('attendance_sessions')
    .select(PASSCODE_SESSION_COLUMNS)
    .eq('status', 'active')
    .eq('passcode_hash', passcodeHash);
  if (error) {
    return { ok: false, code: 'server_error', message: error.message };
  }
  if (!data || data.length !== 1) {
    return {
      ok: false,
      code: 'invalid_token',
      message:
        'The passcode is not valid for a live session right now. Check the code and try again.',
    };
  }
  return { ok: true, session: data[0] };
}
