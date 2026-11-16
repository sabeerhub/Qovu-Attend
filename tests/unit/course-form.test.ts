import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createCourse,
  hasCourseFormErrors,
  mapCreateCourseError,
  normalizeCourseCode,
  validateCourseForm,
  type CourseFormInput,
} from '@/lib/courseForm';
import type { Course } from '@/types/database';

function validInput(overrides: Partial<CourseFormInput> = {}): CourseFormInput {
  return {
    departmentId: 'dept-it',
    semesterId: 'sem-1',
    code: 'CIT 301',
    title: 'Web Technology',
    level: 300,
    creditUnit: 3,
    ...overrides,
  };
}

const createdCourse: Course = {
  id: 'course-1',
  department_id: 'dept-it',
  semester_id: 'sem-1',
  code: 'CIT 301',
  title: 'Web Technology',
  level: 300,
  credit_unit: 3,
  created_at: '2026-11-16T00:00:00.000Z',
};

describe('normalizeCourseCode', () => {
  it('trims and upper-cases the code', () => {
    expect(normalizeCourseCode('  cit 301 ')).toBe('CIT 301');
  });
});

describe('validateCourseForm', () => {
  it('accepts a fully valid form', () => {
    const errors = validateCourseForm(validInput());
    expect(errors).toEqual({});
    expect(hasCourseFormErrors(errors)).toBe(false);
  });

  it('accepts a missing credit unit (nullable in the schema)', () => {
    expect(validateCourseForm(validInput({ creditUnit: null }))).toEqual({});
  });

  it('requires a department and a semester', () => {
    const errors = validateCourseForm(validInput({ departmentId: '', semesterId: '' }));
    expect(errors.departmentId).toMatch(/department/);
    expect(errors.semesterId).toMatch(/semester/);
    expect(hasCourseFormErrors(errors)).toBe(true);
  });

  it('rejects an empty course code and title', () => {
    const errors = validateCourseForm(validInput({ code: '   ', title: '' }));
    expect(errors.code).toMatch(/course code/);
    expect(errors.title).toMatch(/course title/);
  });

  it('rejects a code over 20 characters', () => {
    const errors = validateCourseForm(validInput({ code: 'A'.repeat(21) }));
    expect(errors.code).toMatch(/20 characters/);
  });

  it('rejects a code with disallowed characters', () => {
    const errors = validateCourseForm(validInput({ code: 'CIT-301!' }));
    expect(errors.code).toMatch(/letters, numbers and spaces/);
  });

  it('accepts a lower-case code (normalised before submit)', () => {
    expect(validateCourseForm(validInput({ code: 'cit 301' }))).toEqual({});
  });

  it('rejects a title over 120 characters', () => {
    const errors = validateCourseForm(validInput({ title: 'T'.repeat(121) }));
    expect(errors.title).toMatch(/120 characters/);
  });

  it('rejects a missing or out-of-range level', () => {
    expect(validateCourseForm(validInput({ level: null })).level).toMatch(/level/);
    expect(validateCourseForm(validInput({ level: 50 })).level).toMatch(/100 and 900/);
    expect(validateCourseForm(validInput({ level: 1000 })).level).toMatch(/100 and 900/);
  });

  it('accepts levels 100–900 and rejects non-integers', () => {
    for (const level of [100, 300, 900]) {
      expect(validateCourseForm(validInput({ level }))).toEqual({});
    }
    expect(validateCourseForm(validInput({ level: 350.5 })).level).toMatch(/level/);
  });

  it('rejects credit units outside 1–6', () => {
    expect(validateCourseForm(validInput({ creditUnit: 0 })).creditUnit).toMatch(/1 and 6/);
    expect(validateCourseForm(validInput({ creditUnit: 7 })).creditUnit).toMatch(/1 and 6/);
    expect(validateCourseForm(validInput({ creditUnit: 6 }))).toEqual({});
  });
});

describe('mapCreateCourseError', () => {
  it('maps a duplicate code to a plain message', () => {
    expect(
      mapCreateCourseError(
        'course_code_duplicate: a course with this code already exists in this department for this semester.',
      ),
    ).toMatch(/already exists in this department for this semester/);
  });

  it('maps a missing lecturer profile', () => {
    expect(mapCreateCourseError('lecturer_profile_not_found: ...')).toMatch(
      /no lecturer profile/,
    );
  });

  it('maps missing department / semester', () => {
    expect(mapCreateCourseError('department_not_found: ...')).toMatch(/department does not exist/);
    expect(mapCreateCourseError('semester_not_found: ...')).toMatch(/semester does not exist/);
  });

  it('uses the human detail after the code prefix for unknown codes', () => {
    expect(mapCreateCourseError('course_level_invalid: level must be between 100 and 900.')).toBe(
      'level must be between 100 and 900.',
    );
  });

  it('falls back to a generic message for unparseable errors', () => {
    expect(mapCreateCourseError('boom')).toBe('The course could not be created. Try again.');
  });
});

describe('createCourse (mocked RPC client)', () => {
  function mockClient(result: {
    data: Course | null;
    error: { message: string } | null;
  }) {
    const rpc = vi.fn().mockResolvedValue(result);
    return {
      rpc,
      client: { rpc } as unknown as Pick<SupabaseClient, 'rpc'>,
    };
  }

  it('calls the RPC with normalised values and returns the created course', async () => {
    const { rpc, client } = mockClient({ data: createdCourse, error: null });
    const result = await createCourse(client, validInput({ code: 'cit 301', title: '  Web Technology ' }));
    expect(rpc).toHaveBeenCalledWith('create_lecturer_course', {
      p_department_id: 'dept-it',
      p_semester_id: 'sem-1',
      p_code: 'CIT 301',
      p_title: 'Web Technology',
      p_level: 300,
      p_credit_unit: 3,
    });
    expect(result).toEqual({ course: createdCourse });
  });

  it('maps a server duplicate error to a plain message', async () => {
    const { client } = mockClient({
      data: null,
      error: { message: 'course_code_duplicate: a course with this code already exists.' },
    });
    const result = await createCourse(client, validInput());
    expect(result).toEqual({
      error: 'A course with this code already exists in this department for this semester.',
    });
  });

  it('maps a missing-profile server error', async () => {
    const { client } = mockClient({
      data: null,
      error: { message: 'lecturer_profile_not_found: no profile.' },
    });
    const result = await createCourse(client, validInput());
    expect(result).toEqual({
      error: expect.stringContaining('no lecturer profile'),
    });
  });

  it('returns a generic error when the RPC succeeds with no row', async () => {
    const { client } = mockClient({ data: null, error: null });
    const result = await createCourse(client, validInput());
    expect(result).toEqual({ error: 'The course could not be created. Try again.' });
  });
});
