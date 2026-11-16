import { useState } from 'react';
import { useOverviewStats } from '@/hooks/useOverviewStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { OverviewSkeleton } from '@/components/ui/skeleton';

/**
 * Overview dashboard. Every number comes from a database query
 * (useOverviewStats) — nothing is hardcoded. The department filter
 * re-queries statistics, recent activity and attention courses for
 * that department only. Upcoming lectures render an empty state
 * because timetable integration is not enabled in Phase 1.
 */
export function Overview() {
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const state = useOverviewStats(departmentFilter || null);

  if (state.status === 'not-configured') {
    return (
      <EmptyState
        title="Supabase is not configured yet"
        description="Supabase is not connected yet. No statistics are shown until real data is connected."
      />
    );
  }
  if (state.status === 'loading') return <OverviewSkeleton />;
  if (state.status === 'error') return <ErrorState message={state.message} />;
  if (state.status === 'no-profile') {
    return (
      <EmptyState
        title="No lecturer profile found"
        description="Your account has no lecturer profile yet. Ask your university administrator to create one for your account."
      />
    );
  }

  const { stats, departments, recentSessions, recentRecords, attentionCourses } = state;
  const items = [
    { label: 'Assigned departments', value: stats.departments },
    { label: 'Assigned courses', value: stats.courses },
    { label: 'Attendance sessions', value: stats.sessions },
    { label: 'Attendance records', value: stats.records },
  ];
  const isEmpty = items.every((item) => item.value === 0);

  return (
    <div className="flex flex-col gap-6">
      <label className="flex max-w-xs flex-col gap-1.5 text-[13px] font-medium text-ink">
        Department
        <select
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
        >
          <option value="">All departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </label>

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
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div>
            <h3 className="mb-2 text-[13px] font-medium text-muted">Recent sessions</h3>
            {recentSessions.length === 0 ? (
              <p className="text-[13px] text-muted">No attendance sessions yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {recentSessions.map((session) => (
                  <li key={session.id} className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] text-ink">
                        {session.courseCode ? `${session.courseCode} — ` : ''}
                        {session.title}
                      </p>
                      <p className="text-[13px] text-muted">
                        Week {session.week_number} · {session.lecture_date}
                      </p>
                    </div>
                    <StatusBadge status={session.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-medium text-muted">Recent records</h3>
            {recentRecords.length === 0 ? (
              <p className="text-[13px] text-muted">No attendance records yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {recentRecords.map((record) => (
                  <li key={record.id} className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] text-ink">{record.registration_number}</p>
                      <p className="truncate text-[13px] text-muted">
                        {record.sessionTitle ?? 'Unknown session'}
                      </p>
                    </div>
                    <p className="shrink-0 text-[13px] text-muted">{record.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Courses with no sessions this semester</CardTitle>
        </CardHeader>
        <CardContent>
          {attentionCourses.length === 0 ? (
            <p className="text-[13px] text-muted">
              Every assigned course has at least one session this semester.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {attentionCourses.map((course) => (
                <li key={course.id} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                  <p className="text-[15px] text-ink">
                    {course.code} — {course.title}
                  </p>
                  <p className="text-[13px] text-muted">
                    {course.departmentName} · {course.semesterName}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
