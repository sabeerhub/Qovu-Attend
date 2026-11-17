/**
 * Location helpers (Phase 4, pure where possible, tested).
 *
 * The lecturer's device location, captured at activation, is the
 * anchor for a session. A student's submission is checked
 * server-side against that anchor; the client-side distance math
 * here is display-only and is never a security decision.
 *
 * Honest limits: phone GPS drifts 10–20 m indoors, and GPS can be
 * spoofed with mock-location apps. The radius and accuracy limits
 * below are mitigations, not guarantees (see docs/SECURITY_MODEL.md).
 */

/** Agreed radius (2026-11-16, product owner): if the student and
 *  the lecturer are in the same location and the distance is not
 *  above 30 metres, the student is eligible; above 30 metres the
 *  submission is rejected. */
export const DEFAULT_LOCATION_RADIUS_METERS = 30;

/** A reported position less accurate than this is not trusted. */
export const MAX_LOCATION_ACCURACY_METERS = 100;

export interface GeoCoords {
  latitude: number;
  longitude: number;
  /** Reported accuracy radius in metres, when the device supplies one. */
  accuracy: number | null;
}

export type LocationErrorCode = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

/** Permission state for the Geolocation API, from `navigator.permissions`. */
export type LocationPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown';

/** What the app should do next, given the permission state. Pure. */
export type LocationNextStep = 'blocked' | 'ask' | 'request';

/**
 * Branching for the permission flow, pure and tested. 'denied' means
 * the browser will not re-show its prompt, so the app must show
 * re-allow steps instead of calling getCurrentPosition again.
 * 'unknown' means the browser has no Permissions API — go straight
 * to the capture. 'prompt'/'granted' need an explicit user tap so
 * the browser shows its prompt reliably.
 */
export function nextLocationStep(permission: LocationPermissionState): LocationNextStep {
  if (permission === 'denied') return 'blocked';
  if (permission === 'unknown') return 'request';
  return 'ask';
}

/**
 * Current geolocation permission state. Returns 'unknown' when the
 * browser has no Permissions API or the query fails — the caller
 * then goes straight to the capture. Nothing here runs at import
 * time; `navigator.permissions` is read only when called.
 */
export async function queryLocationPermission(): Promise<LocationPermissionState> {
  const nav = globalThis.navigator as Navigator | undefined;
  const permissions = nav?.permissions;
  if (!permissions || typeof permissions.query !== 'function') return 'unknown';
  try {
    const status = await permissions.query({ name: 'geolocation' });
    const state = status.state;
    if (state === 'granted' || state === 'prompt' || state === 'denied') return state;
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export interface LocationResult {
  ok: boolean;
  coords: GeoCoords | null;
  error: LocationErrorCode | null;
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

export type LocationCheck =
  | { ok: true }
  | { ok: false; code: 'location_too_imprecise' | 'outside_location' };

/**
 * Pure location verdict, mirroring the server-side rule in
 * `supabase/functions/attendance-submit/index.ts` (which is
 * authoritative — this is only for display and pre-flight messages).
 * Returns null when the anchor itself is missing.
 */
export function checkLocation(
  anchor: GeoCoords | null,
  student: GeoCoords | null,
  radiusMeters: number,
): LocationCheck | null {
  if (!anchor || !student) return null;
  if (student.accuracy !== null && student.accuracy > MAX_LOCATION_ACCURACY_METERS) {
    return { ok: false, code: 'location_too_imprecise' };
  }
  if (haversineMeters(anchor, student) > radiusMeters) {
    return { ok: false, code: 'outside_location' };
  }
  return { ok: true };
}

/**
 * Patient device location via the Geolocation API (v0.10.1).
 *
 * A cold GPS fix without mobile data takes 60–120 s (the phone
 * must hear the satellites directly, with no data to speed it up),
 * so a short capture timed out before a good fix arrived — and the
 * old network fallback only ever returned a rough fix that the
 * 100 m accuracy rule rejects anyway. This capture therefore waits
 * patiently for a GOOD fix: repeated high-accuracy attempts for up
 * to 120 s in total (4 attempts of at most 30 s each). A fix whose
 * reported accuracy is worse than 100 m is discarded, never
 * returned — it could only be refused downstream. A denied
 * permission fails fast — the browser will not re-prompt — and
 * 'unsupported' is final too. When nothing good arrives in time
 * the result is a 'timeout' (the caller shows the couldn't-lock
 * screen: try again, or go to the lecturer for a manual add).
 *
 * `onProgress` is called about once a second with the elapsed
 * seconds, so the UI can show it is still trying (a student
 * waiting on a slow GPS fix must not think the app is stuck).
 *
 * Nothing here runs at import time: `navigator.geolocation` is read
 * only when this is called, so server-side rendering and tests stay
 * safe. The same usable-fix rule applies to the lecturer's anchor:
 * a rough anchor would make the 30 m check meaningless, so
 * activation waits for a good fix too. The server still re-checks
 * everything at submit (defence in depth).
 */
export const LOCATION_CAPTURE_TIMEOUT_MS = 120_000;
const LOCATION_CAPTURE_ATTEMPT_TIMEOUT_MS = 30_000;
const LOCATION_CAPTURE_MAX_ATTEMPTS = 4;

const CAPTURE_OPTIONS = (
  timeoutMs: number,
): PositionOptions => ({
  enableHighAccuracy: true,
  timeout: timeoutMs,
  maximumAge: 0,
});

/** A fix is usable only when its reported accuracy is trusted:
 *  100 m or better. An unreported accuracy (null) passes, exactly
 *  as the server rule treats it. */
export function isUsableLocationFix(coords: GeoCoords): boolean {
  return coords.accuracy === null || coords.accuracy <= MAX_LOCATION_ACCURACY_METERS;
}

function requestOnce(options: PositionOptions): Promise<LocationResult> {
  const nav = globalThis.navigator as Navigator | undefined;
  if (!nav || !nav.geolocation) {
    return Promise.resolve({ ok: false, coords: null, error: 'unsupported' });
  }
  return new Promise((resolve) => {
    nav.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          ok: true,
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy:
              typeof position.coords.accuracy === 'number'
                ? position.coords.accuracy
                : null,
          },
          error: null,
        });
      },
      (err) => {
        const code =
          err.code === 1
            ? 'denied'
            : err.code === 2
              ? 'unavailable'
              : err.code === 3
                ? 'timeout'
                : 'unavailable';
        resolve({ ok: false, coords: null, error: code });
      },
      options,
    );
  });
}

export async function requestDeviceLocation(
  onProgress?: (elapsedSeconds: number) => void,
): Promise<LocationResult> {
  const startedAt = Date.now();
  const deadline = startedAt + LOCATION_CAPTURE_TIMEOUT_MS;
  const elapsedSeconds = (): number =>
    Math.floor((Date.now() - startedAt) / 1000);
  // Live "still trying" ticks while an attempt is pending — without
  // these, a 30 s attempt looks stuck to the student.
  const ticker =
    onProgress === undefined
      ? undefined
      : setInterval(() => onProgress(elapsedSeconds()), 1000);
  try {
    for (let attempt = 0; attempt < LOCATION_CAPTURE_MAX_ATTEMPTS; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const result = await requestOnce(
        CAPTURE_OPTIONS(
          Math.min(LOCATION_CAPTURE_ATTEMPT_TIMEOUT_MS, remaining),
        ),
      );
      if (result.ok && result.coords && isUsableLocationFix(result.coords)) {
        return result;
      }
      // A denial is final, and 'unsupported' is final too — retrying
      // would only waste the user's time.
      if (result.error === 'denied' || result.error === 'unsupported') {
        return result;
      }
      // A rough fix (worse than 100 m), a timeout, or an unavailable
      // position: discard it and keep waiting for a good GPS fix
      // while time remains. The next attempt reuses the warming GPS.
      onProgress?.(elapsedSeconds());
    }
    return { ok: false, coords: null, error: 'timeout' };
  } finally {
    if (ticker !== undefined) clearInterval(ticker);
  }
}

/** Plain-language message for a failed location request. */
export function locationErrorMessage(error: LocationErrorCode): string {
  switch (error) {
    case 'denied':
      return 'Location permission was denied. Turn on location for this site in your browser settings and try again.';
    case 'timeout':
      return 'Your location could not be locked in 2 minutes. Move somewhere with a clearer view of the sky — near a window or outside — and try again.';
    case 'unsupported':
      return 'This device or browser cannot provide a location. Attendance needs a device with location services.';
    case 'unavailable':
    default:
      return 'Your location is unavailable right now. Turn on location services and try again.';
  }
}
