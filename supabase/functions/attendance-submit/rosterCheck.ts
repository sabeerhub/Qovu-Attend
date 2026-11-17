// Roster (class-list) check for attendance-submit (v0.9.0).
//
// Master prompt Rule 4: only registration numbers registered in
// the selected course may submit — unless the course has no class
// list yet. The rule is enforced server-side here, never by the
// client: the function re-reads the list from the database.
//
// The rule, exactly:
//   - The submitted number IS on the course's list → allowed.
//   - It is NOT on the list, and the list has at least one student
//     → 403 `reg_number_not_registered`: "This registration number
//     is not on this course's list. Ask your lecturer to add you."
//   - It is NOT on the list, and the list is EMPTY → allowed.
//     This is deliberate: a lecturer who has not added students yet
//     (for example during a hall test) is never locked out of their
//     own session. The moment the first student is added, the list
//     starts being enforced.
//
// This module has no imports on purpose: it is the one piece of
// Edge Function logic that can be unit-tested under vitest (Deno
// is not installed in this workspace, and the shared server helpers
// import the Supabase client from a URL). The caller passes any
// object with the query-builder shape below — the real Supabase
// service client satisfies it at runtime.
//
// Efficiency: at most two cheap indexed queries — a membership
// lookup first (one row), and only when that misses, a one-row
// probe for whether the list is empty. No full list is ever loaded.

export interface RosterQuery {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: unknown,
      ) => {
        eq: (
          column: string,
          value: unknown,
        ) => {
          maybeSingle: () => PromiseLike<{
            data: { reg_number: string } | null;
            error: { message: string } | null;
          }>;
        };
        limit: (
          n: number,
        ) => {
          maybeSingle: () => PromiseLike<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
}

export type RosterCheckResult =
  | { ok: true }
  | {
      ok: false;
      code: 'reg_number_not_registered' | 'server_error';
      message: string;
    };

const NOT_REGISTERED_MESSAGE =
  'This registration number is not on this course’s list. Ask your lecturer to add you.';

/**
 * Is this (already normalized) registration number allowed to
 * submit for this course? `registrationNumber` must already be in
 * the canonical form (trim + uppercase) — the caller normalizes
 * it before this check, the same way it is stored.
 */
export async function checkRosterMembership(
  client: RosterQuery,
  courseId: string,
  registrationNumber: string,
): Promise<RosterCheckResult> {
  const { data, error } = await client
    .from('course_students')
    .select('reg_number')
    .eq('course_id', courseId)
    .eq('reg_number', registrationNumber)
    .maybeSingle();
  if (error) {
    return { ok: false, code: 'server_error', message: error.message };
  }
  if (data) return { ok: true };

  // Not on the list. Only refuse when the list actually has
  // students — an empty list means the lecturer has not added
  // anyone yet, and the submission is allowed exactly as before.
  const { data: anyRow, error: anyError } = await client
    .from('course_students')
    .select('id')
    .eq('course_id', courseId)
    .limit(1)
    .maybeSingle();
  if (anyError) {
    return { ok: false, code: 'server_error', message: anyError.message };
  }
  if (anyRow) {
    return {
      ok: false,
      code: 'reg_number_not_registered',
      message: NOT_REGISTERED_MESSAGE,
    };
  }
  return { ok: true };
}
