/**
 * Device fingerprint (Phase 4, device binding).
 *
 * A stable hash of the device's traits, used to bind one device to
 * one registration number: the first submission from a device locks
 * it to that student, server-side. ONLY the SHA-256 hash ever leaves
 * the device — raw attributes (user agent, screen, canvas pixels)
 * are never sent, stored, or logged.
 *
 * Honest limits: a fingerprint is a hashed deterrent, not a proof of
 * identity. A second phone, a wiped browser, or a spoofed
 * fingerprint can defeat it. It catches the common case (one phone
 * submitting for several students); it does not make proxy
 * attendance impossible. See docs/SECURITY_MODEL.md.
 *
 * Nothing here touches `window` or `navigator` at import time: the
 * real values are read only when `getDeviceFingerprint()` is called,
 * and every collector takes injectable values so tests can run in
 * Node without a browser.
 */

/** The raw traits that go into the hash. All optional — a missing trait is an empty string. */
export interface FingerprintComponents {
  userAgent?: string;
  language?: string;
  timezone?: string;
  platform?: string;
  screen?: string;
  hardwareConcurrency?: number | null;
  deviceMemory?: number | null;
  canvasHash?: string;
}

const FINGERPRINT_VERSION = 'uniattend-device-v1';

/**
 * Canonical string for a set of components. The version prefix
 * keeps hashes stable across future component changes: a new
 * version hashes differently on purpose, so old bindings are not
 * silently mixed with new ones.
 */
export function fingerprintInput(components: FingerprintComponents): string {
  const parts = [
    FINGERPRINT_VERSION,
    components.userAgent ?? '',
    components.language ?? '',
    components.timezone ?? '',
    components.platform ?? '',
    components.screen ?? '',
    components.hardwareConcurrency == null ? '' : String(components.hardwareConcurrency),
    components.deviceMemory == null ? '' : String(components.deviceMemory),
    components.canvasHash ?? '',
  ];
  return parts.join('|');
}

/** SHA-256 hex digest of a string. Null when no secure crypto is available. */
export async function sha256Hex(value: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Hash a set of components. Null when no secure crypto is available. */
export async function hashFingerprint(
  components: FingerprintComponents,
): Promise<string | null> {
  return sha256Hex(fingerprintInput(components));
}

/** Minimal canvas shape, for the trait collector and its tests. */
interface CanvasLike {
  width: number;
  height: number;
  getContext(kind: string): {
    fillRect(x: number, y: number, w: number, h: number): void;
    fillText(text: string, x: number, y: number): void;
    font: string;
    fillStyle: string;
  } | null;
  toDataURL(): string;
}

/**
 * Best-effort canvas trait: draw a fixed string and shapes, read the
 * pixels back. Wrapped so a missing canvas (Node, old browsers, or a
 * blocked context) yields an empty trait instead of throwing.
 */
export function collectCanvasTrait(doc?: {
  createElement?: (tag: string) => unknown;
}): string {
  try {
    const d = doc ?? (typeof document !== 'undefined' ? document : undefined);
    if (!d?.createElement) return '';
    const canvas = d.createElement('canvas') as unknown as CanvasLike | null;
    if (!canvas) return '';
    canvas.width = 200;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (!ctx || !ctx.fillText || !canvas.toDataURL) return '';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#111111';
    ctx.fillText('UniAttend device check', 4, 18);
    ctx.fillStyle = '#0071e3';
    ctx.fillRect(4, 24, 60, 10);
    return canvas.toDataURL();
  } catch {
    return '';
  }
}

/** Read the live traits from the browser. Empty strings when a trait is unavailable. */
export function collectLiveComponents(): FingerprintComponents {
  const nav = globalThis.navigator as Navigator | undefined;
  const scr = globalThis.screen as Screen | undefined;
  let timezone = '';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    timezone = '';
  }
  return {
    userAgent: nav?.userAgent ?? '',
    language: nav?.language ?? '',
    timezone,
    platform: (nav as Navigator & { platform?: string })?.platform ?? '',
    screen: scr
      ? `${scr.width}x${scr.height}x${scr.colorDepth ?? ''}`
      : '',
    hardwareConcurrency: typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    deviceMemory:
      typeof (nav as Navigator & { deviceMemory?: unknown })?.deviceMemory === 'number'
        ? (nav as Navigator & { deviceMemory: number }).deviceMemory
        : null,
    canvasHash: collectCanvasTrait(),
  };
}

/**
 * The device's fingerprint hash, or null when it cannot be computed
 * (no secure crypto, or no browser environment). Callers treat null
 * as "cannot verify this device" and refuse the submission — the
 * server is the enforcement point, and it never accepts a
 * submission without a fingerprint.
 */
export async function getDeviceFingerprint(
  overrides?: FingerprintComponents,
): Promise<string | null> {
  const components = overrides ?? collectLiveComponents();
  return hashFingerprint(components);
}

// ------------------------------------------------- per-browser submit flag
// A UX hint only: "this browser already submitted for X". It lives in
// localStorage, so it is per-browser by nature and never a security
// decision — the server enforces device binding.

function flagKey(sessionId: string): string {
  return `uniattend:submitted:${sessionId}`;
}

/** Registration number this browser already submitted for, if any. */
export function readSubmittedFlag(sessionId: string): string | null {
  try {
    const storage = globalThis.localStorage as Storage | undefined;
    return storage?.getItem(flagKey(sessionId)) ?? null;
  } catch {
    return null;
  }
}

/** Remember that this browser submitted for a registration number. */
export function writeSubmittedFlag(sessionId: string, registrationNumber: string): void {
  try {
    const storage = globalThis.localStorage as Storage | undefined;
    storage?.setItem(flagKey(sessionId), registrationNumber);
  } catch {
    // Private mode / disabled storage: the flag is a hint only.
  }
}
