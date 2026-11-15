import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AttendanceSession } from '@/types/database';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';

/** The lecturer's own attendance sessions (via RLS). */
export function SessionList({ refreshKey }: { refreshKey: number }) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; sessions: AttendanceSession[] }
  >({ status: 'loading' });

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('attendance_sessions')
          .select('id, course_id, lecturer_id, semester_id, lecture_room_id, title, lecture_date, week_number, headcount, qr_expires_in_seconds, status, created_at, updated_at')
          .order('lecture_date', { ascending: false });
        if (error) setState({ status: 'error', message: error.message });
        else setState({ status: 'ready', sessions: (data ?? []) as AttendanceSession[] });
      } catch (err: unknown) {
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not load sessions.' });
      }
    })();
  }, [refreshKey]);

  if (state.status === 'loading') return <LoadingState label="Loading sessions…" />;
  if (state.status === 'error') return <ErrorState message={state.message} />;
  if (state.sessions.length === 0) {
    return (
      <EmptyState
        title="No attendance sessions yet"
        description="Create your first session to start collecting attendance."
      />
    );
  }
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-line text-[12px] uppercase text-muted">
          <th className="py-2 pr-4 font-medium">Title</th>
          <th className="py-2 pr-4 font-medium">Week</th>
          <th className="py-2 pr-4 font-medium">Date</th>
          <th className="py-2 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {state.sessions.map((session) => (
          <tr key={session.id} className="border-b border-line">
            <td className="py-3 pr-4 text-ink">{session.title}</td>
            <td className="py-3 pr-4 text-muted">Week {session.week_number}</td>
            <td className="py-3 pr-4 text-muted">{session.lecture_date}</td>
            <td className="py-3">
              <StatusBadge status={session.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
