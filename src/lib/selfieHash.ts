/**
 * Live-selfie average hash (v0.10.0, pure, tested).
 *
 * The face check is NOT face recognition: there are no student
 * photos on file, so nothing can prove a face belongs to a
 * registration number. All it does is catch the SAME face being
 * used for two different numbers in one session — a deterrent.
 *
 * How: the selfie is downscaled to 8x8, turned to greyscale, and
 * each of the 64 blocks becomes one bit (1 when the block is at or
 * above the image's average brightness). The result is a 16-hex-char
 * string. Two photos of the same face in the same light hash the
 * same (or nearly the same); a different face almost never does.
 * Only the hash is compared server-side — and a match only ever
 * flags the records for lecturer review, never rejects a
 * submission. A similar-looking photo (twins, family, a hash
 * collision) can flag an honest student, which is why the flag is
 * review-only.
 *
 * The hash is computed from raw RGBA pixel data (from a canvas
 * `getImageData` call in `selfieCapture.ts`), never from the JPEG
 * bytes, so the same face hashes the same however the photo was
 * compressed. No face-recognition library, no model file, no new
 * dependency.
 */

export interface RgbaPixels {
  width: number;
  height: number;
  /** RGBA bytes, row-major, length width * height * 4. */
  data: ArrayLike<number>;
}

/** A selfie hash is exactly 16 lowercase hex chars (64 bits). */
const SELFIE_HASH_RE = /^[0-9a-f]{16}$/;

export function isValidSelfieHash(value: unknown): value is string {
  return typeof value === 'string' && SELFIE_HASH_RE.test(value);
}

/**
 * 8x8 average perceptual hash of RGBA pixel data, as 16 hex chars.
 * Returns '' when the input is unusable (no size, or too few
 * bytes) — the caller treats that as "no hash", never as a hash
 * of all zeroes.
 */
export function averageHash(pixels: RgbaPixels): string {
  const { width, height, data } = pixels;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    data.length < width * height * 4
  ) {
    return '';
  }
  // Greyscale, one value per pixel.
  const grey = new Array<number>(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const r = data[i * 4] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    grey[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  // Average each of the 8x8 blocks. Blocks at the right/bottom
  // edges take the leftover pixels, so any image size works.
  const blocks = new Array<number>(64).fill(0);
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const y0 = Math.floor((row * height) / 8);
      const y1 = Math.max(y0 + 1, Math.floor(((row + 1) * height) / 8));
      const x0 = Math.floor((col * width) / 8);
      const x1 = Math.max(x0 + 1, Math.floor(((col + 1) * width) / 8));
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          sum += grey[y * width + x] ?? 0;
          count += 1;
        }
      }
      blocks[row * 8 + col] = count === 0 ? 0 : sum / count;
    }
  }
  const mean = blocks.reduce((a, b) => a + b, 0) / 64;
  // A uniform image (covered camera, blank wall) carries no face
  // information: every block equals the mean, so every covered
  // camera would hash the same and falsely flag honest students.
  // Treat it as no usable hash — the photo is still stored, but
  // no duplicate check runs on it.
  const min = Math.min(...blocks);
  const max = Math.max(...blocks);
  if (max - min === 0) return '';
  // Bit 1 when the block is at or above the mean. Row-major, most
  // significant bit first within each byte.
  let hex = '';
  for (let row = 0; row < 8; row += 1) {
    let byte = 0;
    for (let col = 0; col < 8; col += 1) {
      if ((blocks[row * 8 + col] ?? 0) >= mean) {
        byte |= 1 << (7 - col);
      }
    }
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}
