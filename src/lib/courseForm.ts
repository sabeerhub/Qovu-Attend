/**
 * Course creation validation + RPC call (pure, tested).
 *
 * Runs client-side before any network call, for field-level UX.
 * The server-side backstop is the `create_lecturer_course` RPC
 * (supabase/migrations/20261116000000_lecturer_course_create.sql):
 * it re-validates everything, resolves the lecturer profile from
 * the auth session, and inserts the course and the lecturer's own
 * assignment atomically. The client never inserts into `courses`
 * or `lecturer_assignments` directly.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Course } from '@/types/database';

export interface CourseFormInput {
  departmentId: string;
  semesterId: string;
  code: string;
  title: string;
  level: number | null;
  creditUnit: number | null;
}

export interface CourseFormErrors {
  departmentId?: string;
  semesterId?: string;
  code?: string;
  title?: string;
  level?: string;
  creditUnit?: string;
}

/** Course codes are stored upper-case, surrounding spaces removed. */
export function normalizeCourseCode(code: string): string {
  return code.trim().toUpperCase();
}

export function validateCourseForm(input: CourseFormInput): CourseFormErrors {
  const errors: CourseFormErrors = {};

  if (!input.departmentId) {
    errors.departmentId = 'Choose a department.';
  }
  if (!input.semesterId) {
    errors.semesterId = 'Choose a semester.';
  }

  const code = normalizeCourseCode(input.code);
  if (code.length === 0) {
    errors.code = 'Enter a course code, e.g. CIT 301.';
  } else if (code.length > 20) {
    errors.code = 'Course code must be 20 characters or fewer.';
  } else if (!/^[A-Z0-9][A-Z0-9 ]*$/.test(code)) {
    errors.code = 'Course code may only contain letters, numbers and spaces.';
  }

  const title = input.title.trim();
  if (title.length === 0) {
    errors.title = 'Enter a course title.';
  } else if (title.length > 120) {
    errors.title = 'Course title must be 120 characters or fewer.';
  }

  if (input.level === null || !Number.isInteger(input.level)) {
    errors.level = 'Choose a level.';
  } else if (input.level < 100 || input.level > 900) {
    errors.level = 'Level must be between 100 and 900.';
  }

  if (input.creditUnit !== null) {
    if (!Number.isInteger(input.creditUnit) || input.creditUnit < 1 || input.creditUnit > 6) {
      errors.creditUnit = 'Credit units must be between 1 and 6.';
    }
  }

  return errors;
}

export function hasCourseFormErrors(errors: CourseFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Map a server error to a plain-language message. The RPC prefixes
 * its errors with a stable code ("course_code_duplicate: ..."); the
 * human part after the colon is used when the code is unknown.
 */
export function mapCreateCourseError(message: string): string {
  if (message.includes('course_code_duplicate')) {
    return 'A course with this code already exists in this department for this semester.';
  }
  if (message.includes('lecturer_profile_not_found')) {
    return 'Your account has no lecturer profile yet. Ask your university administrator to create one for your account.';
  }
  if (message.includes('department_not_found')) {
    return 'The selected department does not exist. Choose another department.';
  }
  if (message.includes('semester_not_found')) {
    return 'The selected semester does not exist. Choose another semester.';
  }
  const colon = message.indexOf(':');
  if (colon > 0) {
    const detail = message.slice(colon + 1).trim();
    if (detail.length > 0) return detail;
  }
  return 'The course could not be created. Try again.';
}

/**
 * Create a course through the server-side RPC. Returns the created
 * course on success, or a plain-language error string on failure.
 * `client` is the configured Supabase client.
 */
export async function createCourse(
  client: Pick<SupabaseClient, 'rpc'>,
  input: CourseFormInput,
): Promise<{ course: Course } | { error: string }> {
  const { data, error } = await client.rpc('create_lecturer_course', {
    p_department_id: input.departmentId,
    p_semester_id: input.semesterId,
    p_code: normalizeCourseCode(input.code),
    p_title: input.title.trim(),
    p_level: input.level,
    p_credit_unit: input.creditUnit,
  });
  if (error) {
    return { error: mapCreateCourseError(error.message) };
  }
  if (!data) {
    return { error: 'The course could not be created. Try again.' };
  }
  return { course: data as Course };
}
