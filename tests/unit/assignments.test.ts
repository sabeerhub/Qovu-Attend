import { describe, expect, it } from 'vitest';
import {
  countDistinctCourses,
  countDistinctDepartments,
  courseIdsForDepartment,
  coursesWithNoSessions,
  distinctCourseIds,
  distinctDepartmentIds,
} from '@/lib/assignments';
import type { LecturerAssignment } from '@/types/database';

function assignment(
  overrides: Partial<LecturerAssignment> & { department_id: string; course_id?: string | null },
): LecturerAssignment {
  return {
    id: `a-${overrides.department_id}-${overrides.course_id ?? 'null'}`,
    lecturer_id: 'lecturer-1',
    department_id: overrides.department_id,
    course_id: overrides.course_id ?? null,
    role: 'lecturer',
    created_at: '2026-11-15T00:00:00Z',
  };
}

describe('distinct assignment counts', () => {
  const assignments = [
    assignment({ department_id: 'dept-it', course_id: 'cit-301' }),
    assignment({ department_id: 'dept-it', course_id: 'cit-305' }),
    // Same department again, and a department-level assignment (null course).
    assignment({ department_id: 'dept-it', course_id: null }),
    assignment({ department_id: 'dept-csc', course_id: 'csc-301' }),
    // Duplicate row for the same course must not double-count.
    assignment({ department_id: 'dept-csc', course_id: 'csc-301' }),
  ];

  it('counts distinct departments, not assignment rows', () => {
    expect(distinctDepartmentIds(assignments)).toEqual(['dept-it', 'dept-csc']);
    expect(countDistinctDepartments(assignments)).toBe(2);
  });

  it('counts distinct courses and ignores null course_id', () => {
    expect(distinctCourseIds(assignments)).toEqual(['cit-301', 'cit-305', 'csc-301']);
    expect(countDistinctCourses(assignments)).toBe(3);
  });

  it('counts zero when there are no assignments', () => {
    expect(countDistinctDepartments([])).toBe(0);
    expect(countDistinctCourses([])).toBe(0);
  });

  it('counts zero courses when every assignment is department-level', () => {
    const deptOnly = [assignment({ department_id: 'dept-it', course_id: null })];
    expect(countDistinctDepartments(deptOnly)).toBe(1);
    expect(countDistinctCourses(deptOnly)).toBe(0);
  });

  it('lists course ids for one department only', () => {
    expect(courseIdsForDepartment(assignments, 'dept-it')).toEqual(['cit-301', 'cit-305']);
    expect(courseIdsForDepartment(assignments, 'dept-csc')).toEqual(['csc-301']);
    expect(courseIdsForDepartment(assignments, 'dept-none')).toEqual([]);
  });
});

describe('coursesWithNoSessions', () => {
  const courses = [
    { id: 'cit-301', semester_id: 'sem-1' },
    { id: 'cit-305', semester_id: 'sem-1' },
    { id: 'csc-301', semester_id: 'sem-2' },
  ];

  it('returns courses with no session in their own semester', () => {
    const sessions = new Set(['cit-301:sem-1']);
    expect(coursesWithNoSessions(courses, sessions)).toEqual([
      { id: 'cit-305', semester_id: 'sem-1' },
      { id: 'csc-301', semester_id: 'sem-2' },
    ]);
  });

  it('does not count a session from a different semester', () => {
    const sessions = new Set(['cit-301:sem-2']);
    expect(coursesWithNoSessions(courses, sessions).map((c) => c.id)).toContain('cit-301');
  });

  it('returns an empty list when every course has a session', () => {
    const sessions = new Set(['cit-301:sem-1', 'cit-305:sem-1', 'csc-301:sem-2']);
    expect(coursesWithNoSessions(courses, sessions)).toEqual([]);
  });
});
