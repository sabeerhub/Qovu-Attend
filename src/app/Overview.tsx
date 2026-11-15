import { useOverviewStats } from '@/hooks/useOverviewStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';

/**
 * Overview dashboard. Every number comes from a database query
 * (useOverviewStats) — nothing is hardcoded. With no data, the
 * empty state is shown. Upcoming lectures render an empty state
 * because timetable integration is not enabled in Phase 1.
 */
export function Overview() {
  const state = useOverviewStats();

  if (state.status === 'not-configured') {
    return (
      <EmptyState
        title="Supabase is not configured yet"
        description="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file (copy .env.example), then reload. No statistics are shown until real data is connected."
      />
    );
  }
  if (state.status === 'loading') return <LoadingState label="Loading overview…" />;
  if (state.status === 'error') return <ErrorState message={state.message} />;

  const { stats } = state;
  const items = [
    { label: 'Assigned departments', value: stats.departments },
    { label: 'Assigned courses', value: stats.courses },
    { label: 'Attendance sessions', value: stats.sessions },
    { label: 'Attendance records', value: stats.records },
  ];
  const isEmpty = items.every((item) => item.value === 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardTitle className="text-[13px] font-normal text-muted">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[28px] font-semibold leading-none text-ink">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {isEmpty ? (
        <EmptyState
          title="No attendance data yet"
          description="Once you are assigned to departments and courses and create your first session, your statistics will appear here."
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming lectures</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-muted">
            Timetable integration is not enabled yet, so there are no upcoming lectures to show.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
