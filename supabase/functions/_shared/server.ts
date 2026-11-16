// Shared helpers for the UniAttend Edge Functions (Deno).
// Each function imports this via a relative path, e.g.
//   import { ... } from '../_shared/server.ts';
// Supabase CLI deploys `_shared/` alongside the functions that use it.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(code: string, message: string, status: number): Response {
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

/** SHA-256 hex digest. Tokens/passcodes are stored only as this hash. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Service-role client. The service-role key lives only in the Edge
 * Function environment (Supabase dashboard secrets) — it is never
 * sent to, or readable by, the frontend. It is needed because the
 * client has NO insert/update policy on attendance_records or
 * attendance_audit_logs; all writes go through these functions.
 */
export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('Edge Function is not configured: Supabase connection values missing.');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * The caller's lecturer profile id, from the JWT in the Authorization
 * header. Returns null when there is no valid lecturer session.
 * Anonymous callers (student submission) must NOT use this — they are
 * authorized by the short-lived QR token / passcode instead.
 */
export async function getCallerLecturerId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return null;
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  const service = createServiceClient();
  const { data: profile } = await service
    .from('lecturer_profiles')
    .select('id')
    .eq('user_id', data.user.id)
    .maybeSingle();
  return (profile as { id: string } | null)?.id ?? null;
}

/** Trim + uppercase — the canonical registration-number form. */
export function normalizeRegistrationNumber(raw: string): string {
  return raw.trim().toUpperCase();
}

// ------------------------------------------------------------- location
// Haversine distance (Phase 4). This DUPLICATES the formula in
// src/lib/geo.ts (haversineMeters) — Deno cannot import the
// frontend lib, and the client copy is display-only. The server
// copy here is authoritative; keep the two in step.

export interface GeoCoords {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

/** Great-circle distance in metres between two coordinates. */
export function haversineMeters(a: GeoCoords, b: GeoCoords): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when a finite number is a valid latitude (-90..90). */
export function isValidLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

/** True when a finite number is a valid longitude (-180..180). */
export function isValidLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}
