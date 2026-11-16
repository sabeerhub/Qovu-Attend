import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { transitionSession } from '@/lib/edgeFunctions';
import { locationErrorMessage, requestDeviceLocation } from '@/lib/geo';
import type { AttendanceSession } from '@/types/database';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';
import type { ActivationResult } from './SessionMonitor';

interface SessionRow extends AttendanceSession {
  courses: { code: string } | null;
}

/** The lecturer's own attendance sessions (via RLS), with course code. */
export function SessionList({
  refreshKey,
  onSelect,
}: {
  refreshKey: number;
  onSelect: (session: SessionRow, activation: ActivationResult | null) => void;
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; sessions: SessionRow[] }
  >({ status: 'loading' });
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('attendance_sessions')
          .select(
            'id, course_id, lecturer_id, semester_id, lecture_room_id, title, lecture_date, start_time, week_number, headcount, qr_expires_in_seconds, status, created_at, updated_at, anchor_latitude, anchor_longitude, anchor_accuracy_meters, anchor_captured_at, location_radius_meters, courses(code)',
          )
          .order('lecture_date', { ascending: false });
        if (error) setState({ status: 'error', message: error.message });
        else setState({ status: 'ready', sessions: (data ?? []) as unknown as SessionRow[] });
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

  async function onActivate(session: SessionRow) {
    setActionError(null);
    // Activation (Phase 4) needs the lecturer's location anchor.
    // Without it the session does not start.
    const location = await requestDeviceLocation();
    if (!location.ok || !location.coords) {
      setActionError(
        `Your location is required to start a session. ${locationErrorMessage(location.error ?? 'unavailable')}`,
      );
      return;
    }
    setActivatingId(session.id);
    const result = await transitionSession(session.id, 'active', { anchor: location.coords });
    setActivatingId(null);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    if (result.data.token && result.data.passcode && result.data.session.qr_token_issued_at) {
      onSelect(
        { ...session, status: result.data.session.status },
        {
          token: result.data.token,
          passcode: result.data.passcode,
          issuedAt: result.data.session.qr_token_issued_at,
          expiresInSeconds: result.data.session.qr_expires_in_seconds,
        },
      );
    } else {
      onSelect({ ...session, status: result.data.session.status }, null);
    }
  }

  return (
    <>
      {actionError ? (
        <p className="mb-4 text-[13px] text-danger" role="alert">
          {actionError}
        </p>
      ) : null}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[12px] uppercase text-muted">
            <th className="py-2 pr-4 font-medium">Title</th>
            <th className="py-2 pr-4 font-medium">Course</th>
            <th className="py-2 pr-4 font-medium">Week</th>
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 font-medium"> </th>
          </tr>
        </thead>
        <tbody>
          {state.sessions.map((session) => (
            <tr key={session.id} className="border-b border-line last:border-b-0">
              <td className="py-3 pr-4 text-ink">{session.title}</td>
              <td className="py-3 pr-4 text-muted">{session.courses?.code ?? '—'}</td>
              <td className="py-3 pr-4 text-muted">Week {session.week_number}</td>
              <td className="py-3 pr-4 text-muted">{session.lecture_date}</td>
              <td className="py-3 pr-4">
                <StatusBadge status={session.status} />
              </td>
              <td className="py-3">
                <div className="flex justify-end gap-2">
                  {session.status === 'draft' ? (
                    <Button
                      variant="secondary"
                      disabled={activatingId !== null}
                      onClick={() => void onActivate(session)}
                    >
                      {activatingId === session.id ? 'Activating…' : 'Activate'}
                    </Button>
                  ) : null}
                  <Button variant="secondary" onClick={() => onSelect(session, null)}>
                    Open
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
