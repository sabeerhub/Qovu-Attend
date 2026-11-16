import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { AcademicSession, Department, Semester } from '@/types/database';

export interface ReferenceDepartment extends Department {
  facultyName: string | null;
}

export interface ReferenceSemester extends Semester {
  academicSessionName: string;
}

export interface ReferenceData {
  departments: ReferenceDepartment[];
  semesters: ReferenceSemester[];
}

export type ReferenceDataState =
  | { status: 'not-configured' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ReferenceData };

interface SemesterRow extends Semester {
  academic_sessions: AcademicSession | null;
}

interface DepartmentRow extends Department {
  faculties: { name: string } | null;
}

/**
 * Reference data for the course-creation pickers: every department
 * and every semester (grouped under its academic session). Any
 * signed-in lecturer may read these tables since v0.4.0 — they are
 * reference data, not attendance data. Nothing here is invented:
 * when no departments or semesters exist yet, the lists are empty
 * and the form says so plainly.
 */
export function useCourseReferenceData(refreshKey = 0): ReferenceDataState {
  const [state, setState] = useState<ReferenceDataState>({ status: 'loading' });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setState({ status: 'not-configured' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [deptRes, semRes] = await Promise.all([
          supabase
            .from('departments')
            .select('id, faculty_id, name, code, created_at, faculties(name)')
            .order('name'),
          supabase
            .from('semesters')
            .select(
              'id, academic_session_id, name, start_date, end_date, created_at, ' +
                'academic_sessions(name)',
            )
            .order('name'),
        ]);
        const firstError = [deptRes, semRes].find((r) => r.error);
        if (firstError?.error) throw new Error(firstError.error.message);

        const departments: ReferenceDepartment[] = (
          (deptRes.data ?? []) as unknown as DepartmentRow[]
        ).map((d) => {
          const { faculties, ...rest } = d;
          return { ...rest, facultyName: faculties?.name ?? null };
        });
        const semesters: ReferenceSemester[] = (
          (semRes.data ?? []) as unknown as SemesterRow[]
        ).map((s) => {
          const { academic_sessions: acad, ...rest } = s;
          return { ...rest, academicSessionName: acad?.name ?? 'Unknown session' };
        });

        if (!cancelled) {
          setState({ status: 'ready', data: { departments, semesters } });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load departments and semesters.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return state;
}
