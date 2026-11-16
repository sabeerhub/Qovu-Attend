/**
 * QR tokens + classroom passcodes (Phase 2, pure, tested).
 *
 * Security rules (spec §12, docs/SECURITY_MODEL.md):
 * - Tokens are secure random bytes from `crypto.getRandomValues`
 *   — never `Math.random`. Only the SHA-256 hash of a token is ever
 *   stored (see the Phase 2 migration); the token itself is returned
 *   once to the lecturer at activation and never persisted client-side.
 * - Expiry is decided server-side (Edge Function). The helpers here
 *   are display-only: a countdown in the UI is never the authority
 *   on whether a session is still open.
 * - The client never decides a record's status and never stores a
 *   token hash; it only carries the token the lecturer shows.
 */

export const QR_TOKEN_BYTE_LENGTH = 32;
export const PASSCODE_LENGTH = 6;

/** Secure random bytes via the Web Crypto API. Throws when unavailable. */
function randomBytes(length: number): Uint8Array {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.getRandomValues) {
    throw new Error('Secure random generation is unavailable in this environment.');
  }
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/** URL-safe base64 without padding, so the token survives a URL query string. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generate a secure random QR token (32 random bytes, base64url).
 * Returned once at activation; only its SHA-256 hash is stored.
 */
export function generateQrToken(): string {
  return toBase64Url(randomBytes(QR_TOKEN_BYTE_LENGTH));
}

/**
 * Generate a 6-digit classroom passcode. The first digit is never 0,
 * so the code is always exactly six digits when displayed or spoken.
 */
export function generatePasscode(): string {
  const bytes = randomBytes(4);
  const value = new DataView(bytes.buffer).getUint32(0, false);
  return String(100000 + (value % 900000));
}

/** True when the token's server-side lifetime has elapsed. */
export function isTokenExpired(
  issuedAt: string | Date,
  expiresInSeconds: number,
  now: Date = new Date(),
): boolean {
  const issued = issuedAt instanceof Date ? issuedAt : new Date(issuedAt);
  if (Number.isNaN(issued.getTime()) || expiresInSeconds <= 0) return true;
  return now.getTime() >= issued.getTime() + expiresInSeconds * 1000;
}

/** Whole seconds left before expiry, never below 0. Display-only. */
export function tokenRemainingSeconds(
  issuedAt: string | Date,
  expiresInSeconds: number,
  now: Date = new Date(),
): number {
  const issued = issuedAt instanceof Date ? issuedAt : new Date(issuedAt);
  if (Number.isNaN(issued.getTime()) || expiresInSeconds <= 0) return 0;
  const remainingMs = issued.getTime() + expiresInSeconds * 1000 - now.getTime();
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/** Format a remaining-seconds countdown as `M:SS` (e.g. `4:37`). */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/**
 * The public submission URL for a session, at the app root.
 * Query params (documented in docs/API_CONTRACTS.md):
 * `?submit=<sessionId>&token=<token>`. The token is short-lived;
 * the server is the authority on expiry. The root path is used
 * deliberately: this repo has no SPA rewrite, so a `/submit` path
 * would 404 on the host, while `/` always serves the app and
 * AppShell already reads the query string there.
 */
export function buildSubmitUrl(origin: string, sessionId: string, token: string): string {
  const url = new URL('/', origin);
  url.searchParams.set('submit', sessionId);
  url.searchParams.set('token', token);
  return url.toString();
}

/**
 * The content the QR code encodes: the public submission URL itself.
 * A phone camera only opens a QR code when it contains a URL — the
 * previous JSON payload (`{"v":1,"sessionId":...,"token":...}`) made
 * phones display raw text instead of opening the attendance page.
 * The URL carries no status, no expiry decision and no identity —
 * the server validates the token hash and the expiry.
 */
export function buildQrPayload(origin: string, sessionId: string, token: string): string {
  return buildSubmitUrl(origin, sessionId, token);
}
