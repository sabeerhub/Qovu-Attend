import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAssignments, type AssignedCourse, type AssignedDepartment } from './useAssignments';
import {
  countDistinctCourses,
  countDistinctDepartments,
  courseIdsForDepartment,
  coursesWithNoSessions,
  distinctCourseIds,
} from '@/lib/assignments';
import type { AttendanceRecordStatus, SessionStatus } from '@/types/database';

export interface OverviewStats {
  departments: number;
  courses: number;
  sessions: number;
  records: number;
}

export interface RecentSession {
  id: string;
  title: string;
  lecture_date: string;
  week_number: number;
  status: SessionStatus;
  courseCode: string | null;
}

export interface RecentRecord {
  id: string;
  registration_number: string;
  status: AttendanceRecordStatus;
  submitted_at: string;
  sessionTitle: string | null;
}

export interface AttentionCourse {
  id: string;
  code: string;
  title: string;
  departmentName: string;
  semesterName: string;
}

export type OverviewState =
  | { status: 'not-configured' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'no-profile' }
  | {
      status: 'ready';
      stats: OverviewStats;
      departments: AssignedDepartment[];
      recentSessions: RecentSession[];
      recentRecords: RecentRecord[];
      attentionCourses: AttentionCourse[];
    };

interface SessionRow {
  id: string;
  course_id: string;
  semester_id: string;
  title: string;
  lecture_date: string;
  week_number: number;
  status: SessionStatus;
  created_at: string;
  courses: { code: string } | null;
}

interface RecordRow {
  id: string;
  registration_number: string;
  status: AttendanceRecordStatus;
  submitted_at: string;
  attendance_sessions: { title: string } | null;
}

/**
 * Overview data, calculated from actual database records — never
 * hardcoded. Department and course counts are DISTINCT counts over
 * the lecturer's assignments (a null course_id is a department-level
 * assignment, not a course). When `departmentId` is set, sessions,
 * records, recent activity and attention courses are re-queried
 * filtered to that department's assigned courses.
 */
export function useOverviewStats(departmentId: string | null): OverviewState {
  const assignmentsState = useAssignments();
  const [state, setState] = useState<OverviewState>({ status: 'loading' });

  useEffect(() => {
    if (assignmentsState.status === 'not-configured') {
      setState({ status: 'not-configured' });
      return;
    }
    if (assignmentsState.status === 'loading') {
      setState({ status: 'loading' });
      return;
    }
    if (assignmentsState.status === 'error') {
      setState({ status: 'error', message: assignmentsState.message });
      return;
    }
    if (assignmentsState.status === 'no-profile') {
      setState({ status: 'no-profile' });
      return;
    }
    if (!supabase) {
      setState({ status: 'not-configured' });
      return;
    }

    const { assignments, departments, courses } = assignmentsState.data;
    const filteredCourses: AssignedCourse[] = departmentId
      ? courses.filter((c) => c.department_id === departmentId)
      : courses;
    const courseIds = departmentId
      ? courseIdsForDepartment(assignments, departmentId)
      : distinctCourseIds(assignments);

    let cancelled = false;
    (async () => {
      try {
        const sessionQuery = courseIds.length > 0
          ? supabase
              .from('attendance_sessions')
              .select(
                'id, course_id, semester_id, title, lecture_date, week_number, status, created_at, courses(code)',
              )
              .in('course_id', courseIds)
              .order('created_at', { ascending: false })
          : null;
        const sessionRes = sessionQuery
          ? await sessionQuery
          : { data: [] as SessionRow[], error: null };
        if (sessionRes.error) throw new Error(sessionRes.error.message);
        const sessions = (sessionRes.data ?? []) as SessionRow[];
        const sessionIds = sessions.map((s) => s.id);

        const [recordCountRes, recentRecordRes] = await Promise.all([
          sessionIds.length > 0
            ? supabase
                .from('attendance_records')
                .select('id', { count: 'exact', head: true })
                .in('session_id', sessionIds)
            : Promise.resolve({ count: 0, error: null }),
          sessionIds.length > 0
            ? supabase
                .from('attendance_records')
                .select('id, registration_number, status, submitted_at, attendance_sessions(title)')
                .in('session_id', sessionIds)
                .order('submitted_at', { ascending: false })
                .limit(5)
            : Promise.resolve({ data: [] as RecordRow[], error: null }),
        ]);
        if (recordCountRes.error) throw new Error(recordCountRes.error.message);
        if (recentRecordRes.error) throw new Error(recentRecordRes.error.message);

        if (cancelled) return;
        const sessionKeys = new Set(sessions.map((s) => `${s.course_id}:${s.semester_id}`));
        const attention = coursesWithNoSessions(filteredCourses, sessionKeys).map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
          departmentName: c.departmentName,
          semesterName: c.semesterName,
        }));
        setState({
          status: 'ready',
          stats: {
            departments: departmentId ? 1 : countDistinctDepartments(assignments),
            courses: departmentId
              ? filteredCourses.length
              : countDistinctCourses(assignments),
            sessions: sessions.length,
            records: recordCountRes.count ?? 0,
          },
          departments,
          recentSessions: sessions.slice(0, 5).map((s) => ({
            id: s.id,
            title: s.title,
            lecture_date: s.lecture_date,
            week_number: s.week_number,
            status: s.status,
            courseCode: s.courses?.code ?? null,
          })),
          recentRecords: ((recentRecordRes.data ?? []) as RecordRow[]).map((r) => ({
            id: r.id,
            registration_number: r.registration_number,
            status: r.status,
            submitted_at: r.submitted_at,
            sessionTitle: r.attendance_sessions?.title ?? null,
          })),
          attentionCourses: attention,
        });
      } catch (err: unknown) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load overview.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-run when assignments resolve or the department filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentsState, departmentId]);

  return state;
}
