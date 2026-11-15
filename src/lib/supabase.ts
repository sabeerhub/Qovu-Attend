import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True only when both placeholder env vars have real (non-placeholder) values. */
export const isSupabaseConfigured = Boolean(
  Boolean(supabaseUrl && supabaseAnonKey),
);

/** Raw configured values, for direct Edge Function calls (fetch). */
export const supabaseConfig =
  isSupabaseConfigured && supabaseUrl && supabaseAnonKey
    ? { url: supabaseUrl, anonKey: supabaseAnonKey }
    : null;

/**
 * Supabase client. Created only when configured; otherwise null and
 * the UI must render the "not configured" empty state — never fake data.
 * Only the anon key is used here. No service-role key, ever.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;
