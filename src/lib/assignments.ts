/**
 * Assignment-derived helpers (pure, tested).
 *
 * Everything a lecturer sees is driven by their rows in
 * `lecturer_assignments`. Department and course counts must count
 * DISTINCT ids — a lecturer with two assignments in one department
 * still has one department — and a null `course_id` (a
 * department-level assignment) is not a course.
 */
import type { LecturerAssignment } from '../types/database';

export function distinctDepartmentIds(assignments: readonly LecturerAssignment[]): string[] {
  return [...new Set(assignments.map((a) => a.department_id))];
}

export function distinctCourseIds(assignments: readonly LecturerAssignment[]): string[] {
  return [
    ...new Set(
      assignments
        .map((a) => a.course_id)
        .filter((id): id is string => id !== null),
    ),
  ];
}

export function countDistinctDepartments(assignments: readonly LecturerAssignment[]): number {
  return distinctDepartmentIds(assignments).length;
}

export function countDistinctCourses(assignments: readonly LecturerAssignment[]): number {
  return distinctCourseIds(assignments).length;
}

/** Course ids assigned in one department (null course_id ignored). */
export function courseIdsForDepartment(
  assignments: readonly LecturerAssignment[],
  departmentId: string,
): string[] {
  return [
    ...new Set(
      assignments
        .filter((a) => a.department_id === departmentId)
        .map((a) => a.course_id)
        .filter((id): id is string => id !== null),
    ),
  ];
}

export interface CourseWithSessions {
  id: string;
  semester_id: string;
}

/**
 * Assigned courses with zero sessions in their own semester.
 * `sessionKeys` are `${course_id}:${semester_id}` pairs of existing
 * sessions. The caller labels this plainly ("Courses with no sessions
 * this semester"); it is a prompt to create a session, not a verdict.
 */
export function coursesWithNoSessions<T extends CourseWithSessions>(
  courses: readonly T[],
  sessionKeys: ReadonlySet<string>,
): T[] {
  return courses.filter((c) => !sessionKeys.has(`${c.id}:${c.semester_id}`));
}
