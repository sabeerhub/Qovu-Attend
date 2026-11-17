import { describe, expect, it } from 'vitest';
import {
  findFaceDuplicates,
  flagFaceReview,
  parseSelfieInput,
  type FaceCheckQuery,
} from '../../supabase/functions/attendance-submit/faceCheck';

/** A tiny valid JPEG: SOI marker + a few bytes. */
function tinyJpegBase64(): string {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

describe('parseSelfieInput', () => {
  it('refuses no selfie at all — a live selfie is required', () => {
    expect(parseSelfieInput(undefined, undefined)).toEqual({
      ok: false,
      code: 'selfie_required',
      message:
        'Take a live selfie to submit your attendance. If you have no front camera, ask your lecturer to add you.',
    });
    expect(parseSelfieInput('', '')).toEqual({
      ok: false,
      code: 'selfie_required',
      message:
        'Take a live selfie to submit your attendance. If you have no front camera, ask your lecturer to add you.',
    });
  });

  it('accepts a small JPEG with a valid hash and returns the bytes', () => {
    const result = parseSelfieInput(tinyJpegBase64(), '0f0f0f0f0f0f0f0f');
    expect(result.ok).toBe(true);
    if (result.ok && result.present) {
      expect(result.hash).toBe('0f0f0f0f0f0f0f0f');
      expect(result.bytes[0]).toBe(0xff);
      expect(result.bytes[1]).toBe(0xd8);
      expect(result.bytes.length).toBe(8);
    } else {
      throw new Error('expected a present selfie');
    }
  });

  it('refuses a photo without its hash, and a hash without its photo', () => {
    expect(parseSelfieInput(tinyJpegBase64(), undefined)).toEqual({
      ok: false,
      code: 'invalid_request',
      message: 'A selfie photo and its hash must be sent together.',
    });
    expect(parseSelfieInput(undefined, '0f0f0f0f0f0f0f0f')).toEqual({
      ok: false,
      code: 'invalid_request',
      message: 'A selfie photo and its hash must be sent together.',
    });
  });

  it('refuses a bad hash', () => {
    expect(parseSelfieInput(tinyJpegBase64(), 'not-a-hash')).toEqual({
      ok: false,
      code: 'invalid_request',
      message: 'The selfie hash is not valid.',
    });
    expect(parseSelfieInput(tinyJpegBase64(), '0F0F0F0F0F0F0F0F')).toEqual({
      ok: false,
      code: 'invalid_request',
      message: 'The selfie hash is not valid.',
    });
  });

  it('refuses non-base64 and non-JPEG bytes', () => {
    expect(parseSelfieInput('!!! not base64 !!!', '0f0f0f0f0f0f0f0f')).toEqual({
      ok: false,
      code: 'invalid_request',
      message: 'The selfie photo is not valid.',
    });
    const notJpeg = btoa('hello world, not a jpeg');
    expect(parseSelfieInput(notJpeg, '0f0f0f0f0f0f0f0f')).toEqual({
      ok: false,
      code: 'invalid_request',
      message: 'The selfie photo is not a JPEG image.',
    });
  });

  it('refuses an oversized photo', () => {
    const huge = 'A'.repeat(300_001);
    expect(parseSelfieInput(huge, '0f0f0f0f0f0f0f0f')).toEqual({
      ok: false,
      code: 'invalid_request',
      message: 'The selfie photo is too large.',
    });
  });
});

/**
 * Minimal fake of the Supabase query builder for the two face-check
 * queries: same-hash lookup in one session (excluding the submitting
 * number) and the flag update. It proves what the check actually
 * asks for — not just the decision on canned rows.
 */
type StoredRecord = {
  id: string;
  session_id: string;
  registration_number: string;
  selfie_hash: string | null;
  face_review: boolean | null;
};

function fakeClient(
  records: StoredRecord[],
  forcedError: { message: string } | null = null,
): FaceCheckQuery {
  return {
    from: (_table: string) => ({
      select: (_columns: string) => ({
        eq: (column: string, value: unknown) => {
          const filters: Array<[string, unknown]> = [[column, value]];
          return {
            eq: (column2: string, value2: unknown) => {
              filters.push([column2, value2]);
              return {
                neq: (column3: string, value3: unknown) => {
                  if (forcedError) return Promise.resolve({ data: null, error: forcedError });
                  const found = records.filter((r) =>
                    filters.every(([c, v]) =>
                      c === 'session_id'
                        ? r.session_id === v
                        : c === 'selfie_hash'
                          ? r.selfie_hash === v
                          : false,
                    ) && (column3 === 'registration_number' ? r.registration_number !== value3 : true),
                  );
                  return Promise.resolve({
                    data: found.map((r) => ({ id: r.id, registration_number: r.registration_number })),
                    error: null,
                  });
                },
              };
            },
          };
        },
      }),
      update: (values: Record<string, unknown>) => ({
        in: (_column: string, ids: unknown[]) => {
          if (forcedError) return Promise.resolve({ data: null, error: forcedError });
          for (const r of records) {
            if (ids.includes(r.id)) r.face_review = values.face_review as boolean;
          }
          return Promise.resolve({ data: null, error: null });
        },
      }),
    }),
  };
}

describe('findFaceDuplicates', () => {
  const hash = '0f0f0f0f0f0f0f0f';

  it('finds another number in the same session with the same face hash', async () => {
    const client = fakeClient([
      { id: 'r1', session_id: 's1', registration_number: 'FUD/2022/001', selfie_hash: hash, face_review: null },
      { id: 'r2', session_id: 's1', registration_number: 'FUD/2022/002', selfie_hash: 'aaaaaaaaaaaaaaaa', face_review: null },
    ]);
    await expect(findFaceDuplicates(client, 's1', hash, 'FUD/2022/002')).resolves.toEqual({
      ok: true,
      duplicates: [{ id: 'r1', registration_number: 'FUD/2022/001' }],
    });
  });

  it('does not flag the submitting number itself (re-submission is not a duplicate)', async () => {
    const client = fakeClient([
      { id: 'r1', session_id: 's1', registration_number: 'FUD/2022/001', selfie_hash: hash, face_review: null },
    ]);
    await expect(findFaceDuplicates(client, 's1', hash, 'FUD/2022/001')).resolves.toEqual({
      ok: true,
      duplicates: [],
    });
  });

  it('does not match the same hash in another session', async () => {
    const client = fakeClient([
      { id: 'r1', session_id: 's2', registration_number: 'FUD/2022/001', selfie_hash: hash, face_review: null },
    ]);
    await expect(findFaceDuplicates(client, 's1', hash, 'FUD/2022/002')).resolves.toEqual({
      ok: true,
      duplicates: [],
    });
  });

  it('returns server_error when the database lookup fails', async () => {
    const client = fakeClient([], { message: 'boom' });
    await expect(findFaceDuplicates(client, 's1', hash, 'FUD/2022/001')).resolves.toEqual({
      ok: false,
      code: 'server_error',
      message: 'boom',
    });
  });
});

describe('flagFaceReview', () => {
  it('sets the review flag on the given records and nothing else', async () => {
    const records: StoredRecord[] = [
      { id: 'r1', session_id: 's1', registration_number: 'FUD/2022/001', selfie_hash: '0f0f0f0f0f0f0f0f', face_review: null },
      { id: 'r2', session_id: 's1', registration_number: 'FUD/2022/002', selfie_hash: '0f0f0f0f0f0f0f0f', face_review: null },
      { id: 'r3', session_id: 's1', registration_number: 'FUD/2022/003', selfie_hash: 'bbbbbbbbbbbbbbbb', face_review: null },
    ];
    const client = fakeClient(records);
    await expect(flagFaceReview(client, ['r1', 'r2'])).resolves.toEqual({ ok: true });
    expect(records[0].face_review).toBe(true);
    expect(records[1].face_review).toBe(true);
    expect(records[2].face_review).toBe(null);
  });

  it('does nothing for an empty list', async () => {
    const client = fakeClient([]);
    await expect(flagFaceReview(client, [])).resolves.toEqual({ ok: true });
  });

  it('returns server_error when the update fails', async () => {
    const client = fakeClient([], { message: 'boom' });
    await expect(flagFaceReview(client, ['r1'])).resolves.toEqual({
      ok: false,
      code: 'server_error',
      message: 'boom',
    });
  });
});
