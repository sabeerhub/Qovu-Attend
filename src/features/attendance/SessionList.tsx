import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { transitionSession } from '@/lib/edgeFunctions';
import { DRAFT_SESSION_SELECT } from '@/lib/sessionCreation';
import { locationErrorMessage, nextLocationStep, queryLocationPermission, requestDeviceLocation, type LocationPermissionState } from '@/lib/geo';
import { LocationAllowPanel, LocationBlockedPanel } from '@/components/ui/location-permission';
import type { AttendanceSession } from '@/types/database';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { SessionListSkeleton } from '@/components/ui/skeleton';
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
  // Location permission gate (v0.5.1): activation first asks the
  // browser to share location, from an explicit tap, and shows a
  // visible "Finding your location…" state while the capture runs.
  const [locationGate, setLocationGate] = useState<null | {
    session: SessionRow;
    permission: LocationPermissionState;
  }>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('attendance_sessions')
          .select(DRAFT_SESSION_SELECT)
          .order('lecture_date', { ascending: false });
        if (error) setState({ status: 'error', message: error.message });
        else setState({ status: 'ready', sessions: (data ?? []) as unknown as SessionRow[] });
      } catch (err: unknown) {
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not load sessions.' });
      }
    })();
  }, [refreshKey]);

  if (state.status === 'loading') return <SessionListSkeleton />;
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
    // Explicit permission step (v0.5.1): check the permission state
    // first. A denial never re-prompts, so it shows re-allow steps
    // instead of calling getCurrentPosition; prompt/granted need an
    // explicit tap so the browser shows its prompt reliably.
    const permission = await queryLocationPermission();
    const step = nextLocationStep(permission);
    if (step === 'blocked') {
      setLocationGate({ session, permission });
      return;
    }
    setLocationGate({ session, permission });
    if (step === 'request') {
      // No Permissions API: go straight to the capture, visibly.
      await locateAndActivate(session);
    }
  }

  async function locateAndActivate(session: SessionRow) {
    setLocating(true);
    const location = await requestDeviceLocation();
    setLocating(false);
    setLocationGate(null);
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
      {locationGate ? (
        <div className="mb-4">
          {locationGate.permission === 'denied' ? (
            <LocationBlockedPanel
              onRetry={() => {
                setLocationGate(null);
                void onActivate(locationGate.session);
              }}
            />
          ) : (
            <LocationAllowPanel
              locating={locating}
              onAllow={() => void locateAndActivate(locationGate.session)}
            />
          )}
        </div>
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
                      disabled={activatingId !== null || locationGate !== null}
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
