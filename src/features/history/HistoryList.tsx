/**
 * Attendance History (v0.14.0) — permanent history, real filters,
 * and session detail.
 *
 * The list is the lecturer's own sessions, loaded through the same
 * RLS-scoped query as the session list, so history can only ever
 * show what the lecturer is authorized to see. Filters (department,
 * course, status, date range) narrow that list client-side — they
 * never widen it (see lib/history).
 *
 * Opening a session shows the session monitor itself — live counts,
 * records, manual attendance, lifecycle controls and the export
 * buttons — so history detail can never drift from the workspace.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAssignments } from '@/hooks/useAssignments';
import {
  EMPTY_HISTORY_FILTERS,
  HISTORY_SESSION_SELECT,
  filterHistorySessions,
  hasHistoryFilters,
  type HistoryFilters,
  type HistorySessionRow,
} from '@/lib/history';
import { SessionMonitor } from '@/features/attendance/SessionMonitor';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';
import { SessionListSkeleton } from '@/components/ui/skeleton';

const STATUS_OPTIONS = ['draft', 'active', 'closed', 'finalized', 'archived'] as const;

export function HistoryList() {
  const assignments = useAssignments();
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; sessions: HistorySessionRow[] }
  >({ status: 'loading' });
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_HISTORY_FILTERS);
  const [selected, setSelected] = useState<HistorySessionRow | null>(null);

  useEffect(() => {
    if (!supabase) return;
    setState({ status: 'loading' });
    (async () => {
      try {
        const { data, error } = await supabase
          .from('attendance_sessions')
          .select(HISTORY_SESSION_SELECT)
          .order('lecture_date', { ascending: false });
        if (error) setState({ status: 'error', message: error.message });
        else setState({ status: 'ready', sessions: (data ?? []) as unknown as HistorySessionRow[] });
      } catch (err: unknown) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Could not load history.',
        });
      }
    })();
  }, [refreshKey]);

  if (selected) {
    return (
      <SessionMonitor
        session={selected}
        courseCode={selected.courses?.code ?? null}
        initialActivation={null}
        onBack={() => setSelected(null)}
        onSessionChanged={() => setRefreshKey((k) => k + 1)}
      />
    );
  }

  if (assignments.status === 'not-configured') {
    return (
      <EmptyState
        title="Supabase is not configured yet"
        description="Supabase is not connected yet."
      />
    );
  }
  if (assignments.status === 'loading') return <LoadingState label="Loading history…" />;
  if (assignments.status === 'error') return <ErrorState message={assignments.message} />;
  if (assignments.status === 'no-profile') {
    return (
      <EmptyState
        title="No lecturer profile found"
        description="Your account has no lecturer profile yet. Ask your university administrator to create one for your account."
      />
    );
  }

  const { departments, courses } = assignments.data;
  const coursesForDepartment = filters.departmentId
    ? courses.filter((c) => c.department_id === filters.departmentId)
    : courses;

  function setFilter(patch: Partial<HistoryFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
  }

  function onDepartmentChange(departmentId: string) {
    // A course from another department must not stay selected.
    setFilters((f) => ({
      ...f,
      departmentId,
      courseId:
        departmentId !== '' && f.courseId !== ''
          ? courses.some((c) => c.id === f.courseId && c.department_id === departmentId)
            ? f.courseId
            : ''
          : f.courseId,
    }));
  }

  if (state.status === 'loading') return <SessionListSkeleton />;
  if (state.status === 'error') {
    return <ErrorState message={state.message} onRetry={() => setRefreshKey((k) => k + 1)} />;
  }

  const filtered = filterHistorySessions(state.sessions, filters);
  const filtering = hasHistoryFilters(filters);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-[17px] font-semibold text-ink">Filters</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Department
            <select
              className="h-11 rounded-lg border border-line bg-surface px-3 text-base text-ink md:h-9 md:text-sm"
              value={filters.departmentId}
              onChange={(e) => onDepartmentChange(e.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Course
            <select
              className="h-11 rounded-lg border border-line bg-surface px-3 text-base text-ink md:h-9 md:text-sm"
              value={filters.courseId}
              onChange={(e) => setFilter({ courseId: e.target.value })}
            >
              <option value="">All courses</option>
              {coursesForDepartment.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} — {course.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Status
            <select
              className="h-11 rounded-lg border border-line bg-surface px-3 text-base text-ink md:h-9 md:text-sm"
              value={filters.status}
              onChange={(e) =>
                setFilter({ status: e.target.value as HistoryFilters['status'] })
              }
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            From date
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilter({ dateFrom: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            To date
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilter({ dateTo: e.target.value })}
            />
          </label>
        </div>
        {filtering ? (
          <div>
            <Button variant="secondary" onClick={() => setFilters(EMPTY_HISTORY_FILTERS)}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </section>

      <section>
        <p className="mb-4 text-[13px] text-muted">
          {state.sessions.length === 0
            ? 'No attendance sessions yet.'
            : filtering
              ? `${filtered.length} of ${state.sessions.length} sessions match`
              : `${state.sessions.length} session${state.sessions.length === 1 ? '' : 's'}`}
        </p>
        {state.sessions.length === 0 ? (
          <EmptyState
            title="No history yet"
            description="Completed attendance sessions will appear here. Create your first session to start collecting attendance."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No sessions match these filters"
            description="Try widening the date range or clearing a filter."
          />
        ) : (
          <>
            {/* Phones (v0.13.0 pattern): one card per session. The
                table stays on desktop. */}
            <ul className="flex flex-col gap-3 md:hidden">
              {filtered.map((session) => (
                <li
                  key={session.id}
                  className="rounded-xl border border-line bg-surface p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium text-ink">{session.title}</p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {session.courses?.code ?? '—'} · Week {session.week_number} ·{' '}
                        {session.lecture_date}
                      </p>
                    </div>
                    <span className="shrink-0">
                      <StatusBadge status={session.status} />
                    </span>
                  </div>
                  <div className="mt-3">
                    <Button
                      variant="secondary"
                      onClick={() => setSelected(session)}
                      className="w-full"
                    >
                      Open
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <table className="hidden w-full text-left text-sm md:table">
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
                {filtered.map((session) => (
                  <tr key={session.id} className="border-b border-line last:border-b-0">
                    <td className="py-3 pr-4 text-ink">{session.title}</td>
                    <td className="py-3 pr-4 text-muted">{session.courses?.code ?? '—'}</td>
                    <td className="py-3 pr-4 text-muted">Week {session.week_number}</td>
                    <td className="py-3 pr-4 text-muted">{session.lecture_date}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="py-3 text-right">
                      <Button variant="secondary" onClick={() => setSelected(session)}>
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}
