import { describe, expect, it } from 'vitest';
import {
  checkRosterMembership,
  type RosterQuery,
} from '../../supabase/functions/attendance-submit/rosterCheck';

/**
 * Minimal fake of the Supabase query builder for the two roster
 * queries: a membership lookup (course_id + reg_number) and a
 * one-row probe for whether the class list is empty. It proves
 * what the check actually asks for — not just the decision on
 * canned rows.
 */
function fakeClient(
  students: Array<{ course_id: string; reg_number: string }>,
  forcedError: { message: string } | null = null,
): RosterQuery {
  return {
    from: (_table: string) => ({
      select: (_columns: string) => ({
        eq: (column: string, value: unknown) => {
          const filters: Array<[string, unknown]> = [[column, value]];
          return {
            eq: (column2: string, value2: unknown) => {
              filters.push([column2, value2]);
              return {
                maybeSingle: async () => {
                  if (forcedError) return { data: null, error: forcedError };
                  const found = students.find((s) =>
                    filters.every(([c, v]) =>
                      c === 'course_id'
                        ? s.course_id === v
                        : c === 'reg_number'
                          ? s.reg_number === v
                          : false,
                    ),
                  );
                  return {
                    data: found ? { reg_number: found.reg_number } : null,
                    error: null,
                  };
                },
              };
            },
            limit: (_n: number) => ({
              maybeSingle: async () => {
                if (forcedError) return { data: null, error: forcedError };
                const found = students.find((s) =>
                  filters.every(([c, v]) => (c === 'course_id' ? s.course_id === v : false)),
                );
                return { data: found ? { id: 'row-1' } : null, error: null };
              },
            }),
          };
        },
      }),
    }),
  };
}

describe('checkRosterMembership', () => {
  it('allows a number that is on the course list', async () => {
    const client = fakeClient([
      { course_id: 'course-1', reg_number: 'FUD/2022/001' },
      { course_id: 'course-1', reg_number: 'FUD/2022/002' },
    ]);
    await expect(
      checkRosterMembership(client, 'course-1', 'FUD/2022/001'),
    ).resolves.toEqual({ ok: true });
  });

  it('refuses a number that is not on a non-empty list', async () => {
    const client = fakeClient([
      { course_id: 'course-1', reg_number: 'FUD/2022/001' },
    ]);
    await expect(
      checkRosterMembership(client, 'course-1', 'FUD/2022/999'),
    ).resolves.toEqual({
      ok: false,
      code: 'reg_number_not_registered',
      message:
        'This registration number is not on this course’s list. Ask your lecturer to add you.',
    });
  });

  it('allows anyone when the course list is empty (lecturer has not added students yet)', async () => {
    const client = fakeClient([]);
    await expect(
      checkRosterMembership(client, 'course-1', 'FUD/2022/999'),
    ).resolves.toEqual({ ok: true });
  });

  it('only looks at the session course’s list, not another course’s', async () => {
    const client = fakeClient([
      { course_id: 'course-2', reg_number: 'FUD/2022/999' },
    ]);
    // The number is on course-2's list, but the session is for
    // course-1 — and course-1's list is empty, so it is allowed.
    await expect(
      checkRosterMembership(client, 'course-1', 'FUD/2022/999'),
    ).resolves.toEqual({ ok: true });
    // And the reverse: a number on course-1's list does not help
    // for a course-2 session whose list is non-empty.
    const client2 = fakeClient([
      { course_id: 'course-1', reg_number: 'FUD/2022/001' },
      { course_id: 'course-2', reg_number: 'FUD/2022/002' },
    ]);
    await expect(
      checkRosterMembership(client2, 'course-2', 'FUD/2022/001'),
    ).resolves.toEqual({
      ok: false,
      code: 'reg_number_not_registered',
      message:
        'This registration number is not on this course’s list. Ask your lecturer to add you.',
    });
  });

  it('returns server_error when the database lookup fails', async () => {
    const client = fakeClient([], { message: 'boom' });
    await expect(
      checkRosterMembership(client, 'course-1', 'FUD/2022/001'),
    ).resolves.toEqual({ ok: false, code: 'server_error', message: 'boom' });
  });
});
