// Selfie cleanup at Finalize (v0.10.0).
//
// Photos are deleted after the session — they never leave the
// session. When a session moves closed → finalized, the
// session-transition function deletes every photo under
// sessions/<session_id>/ from the private `session-selfies` bucket
// and clears `selfie_path` on that session's records. The hash
// (16 hex chars) and the review flag stay: they are the record of
// what was checked, and a photo cannot be rebuilt from a hash.
//
// The deletion must never be silent: if listing, removing, or
// clearing fails, the caller reports it as a warning on the
// transition response (the finalize itself still stands —
// re-finalizing a session is not possible, so a silent failure
// would leave photos behind with nobody knowing).
//
// This module has no imports on purpose: it is the one piece of
// Edge Function logic that can be unit-tested under vitest (Deno
// is not installed in this workspace). The caller passes objects
// with the Storage / query-builder shapes below — the real
// Supabase service client satisfies them at runtime.

export interface SelfieStorage {
  list: (
    prefix: string,
    options: { limit: number },
  ) => PromiseLike<{
    data: Array<{ name: string }> | null;
    error: { message: string } | null;
  }>;
  remove: (
    paths: string[],
  ) => PromiseLike<{ error: { message: string } | null }>;
}

export interface SelfieRecordStore {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (
        column: string,
        value: unknown,
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

export type SelfieCleanupResult =
  | { ok: true; deleted: number }
  | {
      ok: false;
      code: 'server_error';
      message: string;
      /** Photos already deleted before the failure, if any. */
      deleted: number;
    };

/**
 * Delete one session's selfie photos and clear their paths.
 * Order matters: remove the photos first, then clear the paths —
 * so a failure never leaves a record pointing at a photo that is
 * gone (that would be a lie), and a failure to clear the paths is
 * reported with the count already deleted.
 */
export async function cleanupSessionSelfies(
  storage: SelfieStorage,
  records: SelfieRecordStore,
  sessionId: string,
): Promise<SelfieCleanupResult> {
  const prefix = `sessions/${sessionId}`;
  const { data: files, error: listError } = await storage.list(prefix, { limit: 1000 });
  if (listError) {
    return { ok: false, code: 'server_error', message: listError.message, deleted: 0 };
  }
  const names = (files ?? []).map((f) => f.name);
  if (names.length > 0) {
    const { error: removeError } = await storage.remove(
      names.map((name) => `${prefix}/${name}`),
    );
    if (removeError) {
      return { ok: false, code: 'server_error', message: removeError.message, deleted: 0 };
    }
  }
  const { error: clearError } = await records
    .from('attendance_records')
    .update({ selfie_path: null })
    .eq('session_id', sessionId);
  if (clearError) {
    return {
      ok: false,
      code: 'server_error',
      message: clearError.message,
      deleted: names.length,
    };
  }
  return { ok: true, deleted: names.length };
}
