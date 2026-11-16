import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Lecturer profile self-creation (v0.7.0).
 *
 * No migration was needed for sign-up: the existing
 * `lecturer_profiles_own` RLS policy (migration
 * 20261115000000_init.sql) is `FOR ALL` with
 * `user_id = auth.uid()` on both sides, so an authenticated user
 * may already insert exactly one row — their own. Nothing here
 * lets a user create a profile for anyone else, and no
 * service-role key is involved.
 */

export interface LecturerProfileRow {
  user_id: string;
  full_name: string;
  email: string;
}

/**
 * Build the profile row for a user from their auth record. Pure.
 * Returns null when the account carries no usable name or email
 * (e.g. an older account created without `full_name` metadata) —
 * the caller must not invent a name.
 */
export function buildLecturerProfileRow(user: User): LecturerProfileRow | null {
  const metadataName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
  if (!metadataName || !user.email) return null;
  return { user_id: user.id, full_name: metadataName, email: user.email };
}

/**
 * Ensure the signed-in lecturer has a profile row, creating only
 * their own when missing. Idempotent: an existing row (unique
 * `user_id`) is left alone, and a race that creates the row first
 * is treated as success. Returns `{ ok: false }` with a plain
 * message when the row cannot be read or created — the caller
 * decides what to show; sign-in itself is never blocked on this.
 */
export async function ensureLecturerProfile(
  client: SupabaseClient,
  user: User,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const row = buildLecturerProfileRow(user);
  if (!row) {
    return {
      ok: false,
      message: 'Your account has no name on it, so a lecturer profile could not be created.',
    };
  }
  const { data: existing, error: readError } = await client
    .from('lecturer_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (readError) return { ok: false, message: readError.message };
  if (existing) return { ok: true };
  const { error } = await client.from('lecturer_profiles').insert(row);
  if (error) {
    if (error.code === '23505') return { ok: true };
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
