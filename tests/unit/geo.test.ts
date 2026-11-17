import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOCATION_RADIUS_METERS,
  checkLocation,
  haversineMeters,
  isUsableLocationFix,
  locationErrorMessage,
  nextLocationStep,
  queryLocationPermission,
  requestDeviceLocation,
  type GeoCoords,
} from '@/lib/geo';

const DUTSE_HALL: GeoCoords = { latitude: 11.7594, longitude: 9.3392, accuracy: 12 };

describe('haversineMeters', () => {
  it('is zero for the same point', () => {
    expect(haversineMeters(DUTSE_HALL, DUTSE_HALL)).toBe(0);
  });

  it('is about 111,195 m for one degree of longitude at the equator', () => {
    const d = haversineMeters(
      { latitude: 0, longitude: 0, accuracy: null },
      { latitude: 0, longitude: 1, accuracy: null },
    );
    expect(d).toBeGreaterThan(111_190);
    expect(d).toBeLessThan(111_200);
  });

  it('is about 343 km from London to Paris', () => {
    const d = haversineMeters(
      { latitude: 51.5074, longitude: -0.1278, accuracy: null },
      { latitude: 48.8566, longitude: 2.3522, accuracy: null },
    );
    expect(d).toBeGreaterThan(342_000);
    expect(d).toBeLessThan(345_000);
  });

  it('is symmetric', () => {
    const a: GeoCoords = { latitude: 11.75, longitude: 9.34, accuracy: null };
    const b: GeoCoords = { latitude: 11.76, longitude: 9.35, accuracy: null };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe('checkLocation (server rule mirror)', () => {
  it('pins the agreed radius at 30 metres', () => {
    expect(DEFAULT_LOCATION_RADIUS_METERS).toBe(30);
  });

  it('accepts a student at the anchor', () => {
    expect(checkLocation(DUTSE_HALL, { ...DUTSE_HALL }, DEFAULT_LOCATION_RADIUS_METERS)).toEqual({
      ok: true,
    });
  });

  it('accepts a student ~20 m away, inside the 30 m radius', () => {
    // 0.00018 degrees of latitude is about 20 m.
    const student: GeoCoords = { latitude: 11.7594 + 0.00018, longitude: 9.3392, accuracy: 10 };
    expect(haversineMeters(DUTSE_HALL, student)).toBeLessThan(30);
    expect(checkLocation(DUTSE_HALL, student, DEFAULT_LOCATION_RADIUS_METERS)).toEqual({ ok: true });
  });

  it('rejects a student ~100 m away as outside the 30 m radius', () => {
    const student: GeoCoords = { latitude: 11.7594 + 0.0009, longitude: 9.3392, accuracy: 10 };
    expect(haversineMeters(DUTSE_HALL, student)).toBeGreaterThan(90);
    expect(checkLocation(DUTSE_HALL, student, DEFAULT_LOCATION_RADIUS_METERS)).toEqual({
      ok: false,
      code: 'outside_location',
    });
  });

  it('rejects a student kilometres away (the screenshot-at-home case)', () => {
    const atHome: GeoCoords = { latitude: 11.8, longitude: 9.4, accuracy: 10 };
    expect(haversineMeters(DUTSE_HALL, atHome)).toBeGreaterThan(5_000);
    expect(checkLocation(DUTSE_HALL, atHome, DEFAULT_LOCATION_RADIUS_METERS)).toEqual({
      ok: false,
      code: 'outside_location',
    });
  });

  it('rejects a position less accurate than 100 m, even inside the radius', () => {
    const imprecise: GeoCoords = { ...DUTSE_HALL, accuracy: 150 };
    expect(checkLocation(DUTSE_HALL, imprecise, DEFAULT_LOCATION_RADIUS_METERS)).toEqual({
      ok: false,
      code: 'location_too_imprecise',
    });
  });

  it('accepts accuracy of exactly 100 m (the boundary is "worse than 100")', () => {
    const edge: GeoCoords = { ...DUTSE_HALL, accuracy: 100 };
    expect(checkLocation(DUTSE_HALL, edge, DEFAULT_LOCATION_RADIUS_METERS)).toEqual({ ok: true });
  });

  it('returns null without an anchor or without a student position', () => {
    expect(checkLocation(null, DUTSE_HALL, DEFAULT_LOCATION_RADIUS_METERS)).toBeNull();
    expect(checkLocation(DUTSE_HALL, null, DEFAULT_LOCATION_RADIUS_METERS)).toBeNull();
  });

  it('uses the session radius, not a hardcoded one', () => {
    const far: GeoCoords = { latitude: 11.7594 + 0.0009, longitude: 9.3392, accuracy: 10 };
    expect(checkLocation(DUTSE_HALL, far, 150)).toEqual({ ok: true });
  });
});

describe('requestDeviceLocation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports unsupported with no Geolocation API (Node test env)', async () => {
    const result = await requestDeviceLocation();
    expect(result).toEqual({ ok: false, coords: null, error: 'unsupported' });
  });

  it('succeeds on the first high-accuracy attempt (30 s, no cache)', async () => {
    const { calls } = mockGeolocation([
      { kind: 'success', latitude: 11.7594, longitude: 9.3392, accuracy: 12 },
    ]);
    const result = await requestDeviceLocation();
    expect(result).toEqual({
      ok: true,
      coords: { latitude: 11.7594, longitude: 9.3392, accuracy: 12 },
      error: null,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 });
  });

  it('retries with high accuracy when the first attempts time out — a good fix arriving late (70 s) is accepted', async () => {
    const { calls } = mockGeolocation([
      { kind: 'error', code: 3 },
      { kind: 'error', code: 3 },
      { kind: 'success', latitude: 11.7594, longitude: 9.3392, accuracy: 12 },
    ]);
    const result = await requestDeviceLocation();
    expect(result).toEqual({
      ok: true,
      coords: { latitude: 11.7594, longitude: 9.3392, accuracy: 12 },
      error: null,
    });
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call).toEqual({ enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 });
    }
  });

  it('retries with high accuracy when an attempt is unavailable', async () => {
    const { calls } = mockGeolocation([
      { kind: 'error', code: 2 },
      { kind: 'success', latitude: 11.7594, longitude: 9.3392, accuracy: 60 },
    ]);
    const result = await requestDeviceLocation();
    expect(result.ok).toBe(true);
    expect(result.coords?.accuracy).toBe(60);
    expect(calls).toHaveLength(2);
  });

  it('discards a rough fix (worse than 100 m) and keeps waiting for a good one — never a network fallback', async () => {
    const { calls } = mockGeolocation([
      { kind: 'success', latitude: 11.7594, longitude: 9.3392, accuracy: 800 },
      { kind: 'success', latitude: 11.7594, longitude: 9.3392, accuracy: 12 },
    ]);
    const result = await requestDeviceLocation();
    expect(result).toEqual({
      ok: true,
      coords: { latitude: 11.7594, longitude: 9.3392, accuracy: 12 },
      error: null,
    });
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.enableHighAccuracy).toBe(true);
    }
  });

  it('times out after the attempts are spent when only rough fixes arrive', async () => {
    const { calls } = mockGeolocation([
      { kind: 'success', latitude: 11.7594, longitude: 9.3392, accuracy: 800 },
      { kind: 'success', latitude: 11.7594, longitude: 9.3392, accuracy: 500 },
      { kind: 'success', latitude: 11.7594, longitude: 9.3392, accuracy: 650 },
      { kind: 'success', latitude: 11.7594, longitude: 9.3392, accuracy: 400 },
    ]);
    const result = await requestDeviceLocation();
    expect(result).toEqual({ ok: false, coords: null, error: 'timeout' });
    expect(calls).toHaveLength(4);
  });

  it('times out after the attempts are spent when every attempt errors', async () => {
    const { calls } = mockGeolocation([
      { kind: 'error', code: 3 },
      { kind: 'error', code: 2 },
      { kind: 'error', code: 3 },
      { kind: 'error', code: 2 },
    ]);
    const result = await requestDeviceLocation();
    expect(result).toEqual({ ok: false, coords: null, error: 'timeout' });
    expect(calls).toHaveLength(4);
  });

  it('fails fast on a denial — no retry after the browser says no', async () => {
    const { calls, getCurrentPosition } = mockGeolocation([{ kind: 'error', code: 1 }]);
    const result = await requestDeviceLocation();
    expect(result).toEqual({ ok: false, coords: null, error: 'denied' });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
  });

  it('reports elapsed seconds while waiting, and stops ticking after a fix', async () => {
    vi.useFakeTimers();
    try {
      const pending: Array<{ success: PositionCallback; error: PositionErrorCallback }> = [];
      const getCurrentPosition = vi.fn(
        (success: PositionCallback, error?: PositionErrorCallback | null) => {
          pending.push({ success, error: error as PositionErrorCallback });
        },
      );
      vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
      const onProgress = vi.fn();
      const promise = requestDeviceLocation(onProgress);
      await vi.advanceTimersByTimeAsync(3000);
      expect(onProgress).toHaveBeenCalledWith(1);
      expect(onProgress).toHaveBeenCalledWith(2);
      expect(onProgress).toHaveBeenCalledWith(3);
      pending[0].success({
        coords: {
          latitude: 11.7594,
          longitude: 9.3392,
          accuracy: 12,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
      await expect(promise).resolves.toEqual({
        ok: true,
        coords: { latitude: 11.7594, longitude: 9.3392, accuracy: 12 },
        error: null,
      });
      onProgress.mockClear();
      await vi.advanceTimersByTimeAsync(5000);
      expect(onProgress).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});

describe('queryLocationPermission', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the browser’s reported state', async () => {
    for (const state of ['denied', 'prompt', 'granted'] as const) {
      mockPermissions(state);
      await expect(queryLocationPermission()).resolves.toBe(state);
      vi.unstubAllGlobals();
    }
  });

  it('returns unknown with no Permissions API', async () => {
    vi.stubGlobal('navigator', {});
    await expect(queryLocationPermission()).resolves.toBe('unknown');
  });

  it('returns unknown when the query throws', async () => {
    mockPermissions('granted', true);
    await expect(queryLocationPermission()).resolves.toBe('unknown');
  });
});

describe('nextLocationStep (permission branching)', () => {
  it('blocks on denied — the browser will not re-prompt', () => {
    expect(nextLocationStep('denied')).toBe('blocked');
  });

  it('asks for an explicit tap on prompt or granted', () => {
    expect(nextLocationStep('prompt')).toBe('ask');
    expect(nextLocationStep('granted')).toBe('ask');
  });

  it('goes straight to the capture with no Permissions API', () => {
    expect(nextLocationStep('unknown')).toBe('request');
  });
});

describe('isUsableLocationFix (v0.10.1: rough fixes are never accepted)', () => {
  it('accepts accuracy of 100 m or better', () => {
    expect(isUsableLocationFix({ ...DUTSE_HALL, accuracy: 12 })).toBe(true);
    expect(isUsableLocationFix({ ...DUTSE_HALL, accuracy: 100 })).toBe(true);
  });

  it('rejects accuracy worse than 100 m', () => {
    expect(isUsableLocationFix({ ...DUTSE_HALL, accuracy: 101 })).toBe(false);
    expect(isUsableLocationFix({ ...DUTSE_HALL, accuracy: 800 })).toBe(false);
  });

  it('accepts an unreported accuracy, exactly as the server rule does', () => {
    expect(isUsableLocationFix({ ...DUTSE_HALL, accuracy: null })).toBe(true);
  });
});

describe('locationErrorMessage', () => {
  it('explains a denied permission plainly', () => {
    expect(locationErrorMessage('denied')).toMatch(/denied/i);
    expect(locationErrorMessage('denied')).toMatch(/location/i);
  });
});

// --- mocks for the geolocation / permissions tests above ---

type GeoBehavior =
  | { kind: 'success'; latitude: number; longitude: number; accuracy: number }
  | { kind: 'error'; code: number };

function mockGeolocation(behaviors: GeoBehavior[]) {
  const calls: PositionOptions[] = [];
  const getCurrentPosition = vi.fn(
    (
      success: PositionCallback,
      error: PositionErrorCallback | null | undefined,
      options?: PositionOptions,
    ) => {
      calls.push(options ?? {});
      const behavior = behaviors.shift();
      if (!behavior || behavior.kind === 'error') {
        const code = behavior && behavior.kind === 'error' ? behavior.code : 3;
        (error as PositionErrorCallback)({
          code,
          message: 'mock geolocation error',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
        return;
      }
      success({
        coords: {
          latitude: behavior.latitude,
          longitude: behavior.longitude,
          accuracy: behavior.accuracy,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    },
  );
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
  return { calls, getCurrentPosition };
}

function mockPermissions(state: 'denied' | 'prompt' | 'granted', rejects = false) {
  const query = rejects
    ? vi.fn(async () => {
        throw new Error('permissions unavailable');
      })
    : vi.fn(async () => ({ state }));
  vi.stubGlobal('navigator', { permissions: { query } });
  return query;
}
