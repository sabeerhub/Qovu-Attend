import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type {
  AcademicSession,
  Course,
  Department,
  LectureRoom,
  LecturerAssignment,
  LecturerProfile,
  Semester,
} from '@/types/database';

/** A department the lecturer is assigned to, with its faculty name. */
export interface AssignedDepartment extends Department {
  facultyName: string | null;
}

/** An assigned course, with the names it is shown under. */
export interface AssignedCourse extends Course {
  departmentName: string;
  semesterName: string;
  academicSessionName: string;
  semester: Semester | null;
}

export interface AcademicSessionWithSemesters extends AcademicSession {
  semesters: Semester[];
}

export interface AssignmentsData {
  profile: LecturerProfile;
  assignments: LecturerAssignment[];
  departments: AssignedDepartment[];
  courses: AssignedCourse[];
  /** Academic sessions referenced by the assigned courses, with their semesters. */
  academicSessions: AcademicSessionWithSemesters[];
  /** Lecture rooms belonging to the assigned departments. */
  rooms: LectureRoom[];
}

export type AssignmentsState =
  | { status: 'not-configured' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'no-profile' }
  | { status: 'ready'; data: AssignmentsData };

interface DepartmentRow extends Department {
  faculties: { name: string } | null;
}

interface SemesterRow extends Semester {
  academic_sessions: AcademicSession | null;
}

interface CourseRow extends Course {
  departments: { name: string } | null;
  semesters: SemesterRow | null;
}

/**
 * The single source of assignment-driven data for the lecturer portal.
 * Everything the signed-in lecturer sees — departments, courses,
 * semesters, rooms — is loaded through their rows in
 * `lecturer_assignments` (via RLS). Nothing unassigned is ever shown.
 * The profile is looked up by `user_id = auth.uid()`.
 */
export function useAssignments(): AssignmentsState {
  const [state, setState] = useState<AssignmentsState>({ status: 'loading' });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setState({ status: 'not-configured' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw new Error(userError.message);
        const uid = userData.user?.id;
        if (!uid) {
          setState({ status: 'no-profile' });
          return;
        }
        const { data: profileData, error: profileError } = await supabase
          .from('lecturer_profiles')
          .select('id, user_id, full_name, email, staff_id, created_at')
          .eq('user_id', uid)
          .maybeSingle();
        if (profileError) throw new Error(profileError.message);
        const profile = (profileData ?? null) as LecturerProfile | null;
        if (!profile) {
          if (!cancelled) setState({ status: 'no-profile' });
          return;
        }

        const { data: assignmentData, error: assignmentError } = await supabase
          .from('lecturer_assignments')
          .select('id, lecturer_id, department_id, course_id, role, created_at')
          .eq('lecturer_id', profile.id)
          .order('created_at');
        if (assignmentError) throw new Error(assignmentError.message);
        const assignments = (assignmentData ?? []) as LecturerAssignment[];

        const departmentIds = [...new Set(assignments.map((a) => a.department_id))];
        const courseIds = [
          ...new Set(
            assignments.map((a) => a.course_id).filter((id): id is string => id !== null),
          ),
        ];

        const [deptRes, courseRes, roomRes] = await Promise.all([
          departmentIds.length > 0
            ? supabase
                .from('departments')
                .select('id, faculty_id, name, code, created_at, faculties(name)')
                .in('id', departmentIds)
                .order('name')
            : Promise.resolve({ data: [], error: null }),
          courseIds.length > 0
            ? supabase
                .from('courses')
                .select(
                  'id, department_id, semester_id, code, title, level, credit_unit, created_at, ' +
                    'departments(name), ' +
                    'semesters(name, start_date, end_date, academic_session_id, academic_sessions(name, start_date, end_date))',
                )
                .in('id', courseIds)
                .order('code')
            : Promise.resolve({ data: [], error: null }),
          departmentIds.length > 0
            ? supabase
                .from('lecture_rooms')
                .select('id, department_id, name, building, capacity, latitude, longitude, created_at')
                .in('department_id', departmentIds)
                .order('name')
            : Promise.resolve({ data: [], error: null }),
        ]);
        const firstError = [deptRes, courseRes, roomRes].find((r) => r.error);
        if (firstError?.error) throw new Error(firstError.error.message);

        const departments: AssignedDepartment[] = (
          (deptRes.data ?? []) as unknown as DepartmentRow[]
        ).map((d) => {
            const { faculties, ...rest } = d;
            return { ...rest, facultyName: faculties?.name ?? null };
          },
        );

        const semesterMap = new Map<string, Semester>();
        const academicSessionMap = new Map<string, AcademicSessionWithSemesters>();
        const courses: AssignedCourse[] = (
          (courseRes.data ?? []) as unknown as CourseRow[]
        ).map((c) => {
          const { departments: deptJoin, semesters: sem, ...rest } = c;
          if (sem) {
            const { academic_sessions: acad, ...semesterFields } = sem;
            semesterMap.set(sem.id, semesterFields);
            if (acad && !academicSessionMap.has(acad.id)) {
              academicSessionMap.set(acad.id, { ...acad, semesters: [] });
            }
          }
          return {
            ...rest,
            departmentName: deptJoin?.name ?? 'Unknown department',
            semesterName: sem?.name ?? 'Unknown semester',
            academicSessionName: sem?.academic_sessions?.name ?? 'Unknown session',
            semester: sem
              ? {
                  id: sem.id,
                  academic_session_id: sem.academic_session_id,
                  name: sem.name,
                  start_date: sem.start_date,
                  end_date: sem.end_date,
                  created_at: sem.created_at,
                }
              : null,
          };
        });

        for (const sem of semesterMap.values()) {
          const acad = academicSessionMap.get(sem.academic_session_id);
          if (acad && !acad.semesters.some((s) => s.id === sem.id)) {
            acad.semesters.push(sem);
          }
        }
        const academicSessions = [...academicSessionMap.values()].sort((a, b) =>
          a.name.localeCompare(b.name),
        );

        const rooms = (roomRes.data ?? []) as LectureRoom[];

        if (!cancelled) {
          setState({
            status: 'ready',
            data: { profile, assignments, departments, courses, academicSessions, rooms },
          });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load your assignments.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
