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
 * Two-stage device location via the Geolocation API (v0.5.1).
 *
 * A high-accuracy GPS fix indoors routinely takes longer than a few
 * seconds or fails outright, so a single short high-accuracy attempt
 * refused activations even with location services on. Stage 1 tries
 * high accuracy for 30 s; only a timeout or an unavailable position
 * falls through to stage 2, a network-based fix for 15 s (cached
 * fixes up to 30 s old are accepted). A denied permission fails fast
 * — the browser will not re-prompt — and 'unsupported' is final too.
 * The first usable fix is returned.
 *
 * Nothing here runs at import time: `navigator.geolocation` is read
 * only when this is called, so server-side rendering and tests stay
 * safe. The anchor accepts any accuracy (it is stored and shown);
 * the 100 m cap stays a student-submission rule only.
 */
const STAGE_ONE_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 30_000,
  maximumAge: 0,
};
const STAGE_TWO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 15_000,
  maximumAge: 30_000,
};

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

export async function requestDeviceLocation(): Promise<LocationResult> {
  const first = await requestOnce(STAGE_ONE_OPTIONS);
  if (first.ok) return first;
  // A denial is final, and 'unsupported' is final too — retrying
  // would only waste the user's time.
  if (first.error === 'denied' || first.error === 'unsupported') return first;
  // Timeout or unavailable: a network-based fix may still work.
  return requestOnce(STAGE_TWO_OPTIONS);
}

/** Plain-language message for a failed location request. */
export function locationErrorMessage(error: LocationErrorCode): string {
  switch (error) {
    case 'denied':
      return 'Location permission was denied. Turn on location for this site in your browser settings and try again.';
    case 'timeout':
      return 'Your location could not be found in time. Move somewhere with a clearer GPS signal and try again.';
    case 'unsupported':
      return 'This device or browser cannot provide a location. Attendance needs a device with location services.';
    case 'unavailable':
    default:
      return 'Your location is unavailable right now. Turn on location services and try again.';
  }
}
