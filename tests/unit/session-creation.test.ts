import { describe, expect, it, vi } from 'vitest';
import {
  DRAFT_SESSION_SELECT,
  createDraftSession,
  type CreateDraftSessionInput,
} from '@/lib/sessionCreation';

const input: CreateDraftSessionInput = {
  courseId: 'course-1',
  lecturerId: 'lecturer-1',
  semesterId: 'semester-1',
  lectureRoomId: null,
  title: 'Web Technology',
  lectureDate: '2026-11-17',
  startTime: '08:00',
  weekNumber: 1,
  headcount: null,
  qrExpiresInSeconds: 300,
};

/** Minimal chainable stand-in for the Supabase query builder. */
function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const single = vi.fn(async () => result);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as never, insert, select, single };
}

describe('createDraftSession', () => {
  it('inserts a Draft with the system-set fields and reads it back with its course code', async () => {
    const row = {
      id: 'session-1',
      course_id: 'course-1',
      status: 'draft',
      courses: { code: 'CIT 301' },
    };
    const { client, insert, select } = fakeClient({ data: row, error: null });
    const result = await createDraftSession(client, input);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        course_id: 'course-1',
        lecturer_id: 'lecturer-1',
        semester_id: 'semester-1',
        lecture_room_id: null,
        title: 'Web Technology',
        lecture_date: '2026-11-17',
        start_time: '08:00',
        week_number: 1,
        headcount: null,
        qr_expires_in_seconds: 300,
        status: 'draft',
      }),
    );
    expect(select).toHaveBeenCalledWith(DRAFT_SESSION_SELECT);
    expect(result).toEqual({ session: row });
  });

  it('trims the title before inserting', async () => {
    const { client, insert } = fakeClient({ data: { id: 's1' }, error: null });
    await createDraftSession(client, { ...input, title: '  Web Technology  ' });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Web Technology' }));
  });

  it('returns the database error message on failure', async () => {
    const { client } = fakeClient({
      data: null,
      error: { message: 'new row violates row-level security policy' },
    });
    const result = await createDraftSession(client, input);
    expect(result).toEqual({ error: 'new row violates row-level security policy' });
  });

  it('returns a generic error when no row comes back', async () => {
    const { client } = fakeClient({ data: null, error: null });
    const result = await createDraftSession(client, input);
    expect(result).toEqual({ error: 'The session could not be created. Try again.' });
  });
});
