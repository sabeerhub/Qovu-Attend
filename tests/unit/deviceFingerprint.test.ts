import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectCanvasTrait,
  collectLiveComponents,
  fingerprintInput,
  getDeviceFingerprint,
  hashFingerprint,
  readSubmittedFlag,
  sha256Hex,
  writeSubmittedFlag,
  type FingerprintComponents,
} from '@/lib/deviceFingerprint';

const PHONE: FingerprintComponents = {
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7)',
  language: 'en-GB',
  timezone: 'Africa/Lagos',
  platform: 'Linux armv8l',
  screen: '1080x2400x24',
  hardwareConcurrency: 8,
  deviceMemory: 8,
  canvasHash: 'canvas-abc',
};

describe('sha256Hex', () => {
  it('matches the known SHA-256 vector for "abc"', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('fingerprint hashing', () => {
  it('is a 64-character lowercase hex string', async () => {
    const hash = await hashFingerprint(PHONE);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable for the same components', async () => {
    expect(await hashFingerprint(PHONE)).toBe(await hashFingerprint({ ...PHONE }));
  });

  it('changes when any component changes', async () => {
    const base = await hashFingerprint(PHONE);
    expect(await hashFingerprint({ ...PHONE, userAgent: 'Mozilla/5.0 (other)' })).not.toBe(base);
    expect(await hashFingerprint({ ...PHONE, screen: '720x1600x24' })).not.toBe(base);
    expect(await hashFingerprint({ ...PHONE, canvasHash: 'canvas-xyz' })).not.toBe(base);
  });

  it('treats a missing trait as empty, not as an error', async () => {
    const hash = await hashFingerprint({ userAgent: 'x' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('prefixes the input with the version, so future component changes re-hash', () => {
    expect(fingerprintInput(PHONE).startsWith('uniattend-device-v1|')).toBe(true);
  });
});

describe('fingerprint collection without a browser', () => {
  it('canvas trait is empty when there is no document', () => {
    expect(collectCanvasTrait()).toBe('');
  });

  it('live components degrade gracefully with no browser globals', () => {
    // Node 24 exposes a navigator (userAgent "Node.js/…") but no
    // screen; the point is the collectors never throw and never
    // depend on window at import time.
    const live = collectLiveComponents();
    expect(typeof live.userAgent).toBe('string');
    expect(live.screen).toBe('');
    expect(typeof live.timezone).toBe('string');
  });

  it('getDeviceFingerprint still produces a hash in Node (crypto only)', async () => {
    const hash = await getDeviceFingerprint(PHONE);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('per-browser submitted flag (UX hint only)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null with no storage available', () => {
    expect(readSubmittedFlag('session-1')).toBeNull();
  });

  it('round-trips through a stubbed localStorage', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    } as Storage);
    expect(readSubmittedFlag('session-1')).toBeNull();
    writeSubmittedFlag('session-1', 'FUT/2022/001');
    expect(readSubmittedFlag('session-1')).toBe('FUT/2022/001');
    expect(readSubmittedFlag('session-2')).toBeNull();
  });
});
