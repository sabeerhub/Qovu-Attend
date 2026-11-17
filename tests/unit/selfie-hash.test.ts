import { describe, expect, it } from 'vitest';
import { averageHash, isValidSelfieHash, type RgbaPixels } from '../../src/lib/selfieHash';

/** Build an 8x8 RGBA image from one grey value per pixel (row-major). */
function greyImage(values: number[], width = 8, height = 8): RgbaPixels {
  const data = new Array<number>(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const v = values[i] ?? 0;
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

describe('averageHash', () => {
  it('returns empty for a uniform image — a covered camera carries no face information', () => {
    expect(averageHash(greyImage(new Array(64).fill(0)))).toBe('');
    expect(averageHash(greyImage(new Array(64).fill(255)))).toBe('');
    expect(averageHash(greyImage(new Array(64).fill(128)))).toBe('');
  });

  it('hashes a left-black / right-white split to 0f per row', () => {
    const values: number[] = [];
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        values.push(col < 4 ? 0 : 255);
      }
    }
    expect(averageHash(greyImage(values))).toBe('0f0f0f0f0f0f0f0f');
  });

  it('gives the same hash for the same picture at a bigger size', () => {
    // The same left-black / right-white split, drawn at 16x16.
    const values: number[] = [];
    for (let row = 0; row < 16; row += 1) {
      for (let col = 0; col < 16; col += 1) {
        values.push(col < 8 ? 0 : 255);
      }
    }
    expect(averageHash(greyImage(values, 16, 16))).toBe('0f0f0f0f0f0f0f0f');
  });

  it('gives a different hash for the opposite split', () => {
    const values: number[] = [];
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        values.push(col < 4 ? 255 : 0);
      }
    }
    expect(averageHash(greyImage(values))).toBe('f0f0f0f0f0f0f0f0');
  });

  it('returns empty for unusable input, never a fake hash', () => {
    expect(averageHash({ width: 0, height: 8, data: [] })).toBe('');
    expect(averageHash({ width: 8, height: 8, data: [] })).toBe('');
    expect(averageHash({ width: 8, height: 8, data: new Array(10).fill(0) })).toBe('');
  });
});

describe('isValidSelfieHash', () => {
  it('accepts exactly 16 lowercase hex chars', () => {
    expect(isValidSelfieHash('0f0f0f0f0f0f0f0f')).toBe(true);
    expect(isValidSelfieHash('ffffffffffffffff')).toBe(true);
    expect(isValidSelfieHash('0000000000000000')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidSelfieHash('0f0f0f0f0f0f0f0')).toBe(false); // 15 chars
    expect(isValidSelfieHash('0f0f0f0f0f0f0f0f00')).toBe(false); // 18 chars
    expect(isValidSelfieHash('0F0F0F0F0F0F0F0F')).toBe(false); // uppercase
    expect(isValidSelfieHash('gf0f0f0f0f0f0f0f')).toBe(false); // not hex
    expect(isValidSelfieHash('')).toBe(false);
    expect(isValidSelfieHash(null)).toBe(false);
    expect(isValidSelfieHash(undefined)).toBe(false);
    expect(isValidSelfieHash(123)).toBe(false);
  });
});
