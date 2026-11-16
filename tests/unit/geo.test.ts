import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCATION_RADIUS_METERS,
  checkLocation,
  haversineMeters,
  locationErrorMessage,
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
  it('reports unsupported with no Geolocation API (Node test env)', async () => {
    const result = await requestDeviceLocation();
    expect(result).toEqual({ ok: false, coords: null, error: 'unsupported' });
  });
});

describe('locationErrorMessage', () => {
  it('explains a denied permission plainly', () => {
    expect(locationErrorMessage('denied')).toMatch(/denied/i);
    expect(locationErrorMessage('denied')).toMatch(/location/i);
  });
});
