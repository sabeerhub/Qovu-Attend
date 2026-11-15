import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export interface OverviewStats {
  departments: number;
  courses: number;
  sessions: number;
  records: number;
}

export type OverviewState =
  | { status: 'not-configured' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; stats: OverviewStats };

/**
 * Overview statistics, calculated from actual database records —
 * never hardcoded. When Supabase is not configured, or the lecturer
 * has no data, the caller renders the empty state.
 */
export function useOverviewStats(): OverviewState {
  const [state, setState] = useState<OverviewState>({ status: 'loading' });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setState({ status: 'not-configured' });
      return;
    }
    let cancelled = false;
    (async () => {
      const [departments, courses, sessions, records] = await Promise.all([
        supabase.from('lecturer_assignments').select('department_id', { count: 'exact', head: true }),
        supabase.from('lecturer_assignments').select('course_id', { count: 'exact', head: true }),
        supabase.from('attendance_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('attendance_records').select('id', { count: 'exact', head: true }),
      ]);
      if (cancelled) return;
      const firstError = [departments, courses, sessions, records].find((r) => r.error);
      if (firstError?.error) {
        setState({ status: 'error', message: firstError.error.message });
        return;
      }
      setState({
        status: 'ready',
        stats: {
          departments: departments.count ?? 0,
          courses: courses.count ?? 0,
          sessions: sessions.count ?? 0,
          records: records.count ?? 0,
        },
      });
    })().catch((err: unknown) => {
      if (!cancelled) {
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not load overview.' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
