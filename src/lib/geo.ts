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
 * One-shot device location via the Geolocation API. Nothing here
 * runs at import time: `navigator.geolocation` is read only when
 * this is called, so server-side rendering and tests stay safe.
 * The caller decides the timeout; 10 s is the default.
 */
export function requestDeviceLocation(timeoutMs = 10_000): Promise<LocationResult> {
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
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
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
