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
    <div className="flex flex-col gap-8">
      <label className="flex w-full flex-col gap-2 text-[13px] font-medium text-ink sm:max-w-xs">
        Department
        <select
          className="h-11 rounded-lg border border-line bg-surface px-3 text-base text-ink md:h-9 md:text-sm"
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

      {/* One grouped stat card (v0.13.1): big numbers on top,
          labels underneath — no cramped four-card wall. */}
      <Card>
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col gap-1 px-5 py-5">
              <p className="text-[34px] font-semibold leading-none tracking-tight text-ink">
                {item.value}
              </p>
              <p className="text-[13px] text-muted">{item.label}</p>
            </div>
          ))}
        </div>
      </Card>
      {isEmpty ? (
        <EmptyState
          title="No attendance data yet"
          description="Once you are assigned to departments and courses and create your first session, your statistics will appear here."
        />
      ) : null}

      <Card>
        <CardHeader className="px-5 pt-5 sm:px-6">
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-8 px-5 py-5 sm:px-6">
          <section>
            <h3 className="mb-1 text-[15px] font-semibold text-ink">Recent sessions</h3>
            {recentSessions.length === 0 ? (
              <p className="text-[13px] text-muted">No attendance sessions yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {recentSessions.map((session) => (
                  <li key={session.id} className="flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-[17px] text-ink">
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
          </section>
          <section>
            <h3 className="mb-1 text-[15px] font-semibold text-ink">Recent records</h3>
            {recentRecords.length === 0 ? (
              <p className="text-[13px] text-muted">No attendance records yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {recentRecords.map((record) => (
                  <li key={record.id} className="flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-[17px] text-ink">{record.registration_number}</p>
                      <p className="truncate text-[13px] text-muted">
                        {record.sessionTitle ?? 'Unknown session'}
                      </p>
                    </div>
                    <p className="shrink-0 text-[13px] text-muted">{record.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-5 pt-5 sm:px-6">
          <CardTitle>Courses with no sessions this semester</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-5 sm:px-6">
          {attentionCourses.length === 0 ? (
            <p className="text-[13px] text-muted">
              Every assigned course has at least one session this semester.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {attentionCourses.map((course) => (
                <li key={course.id} className="flex flex-col gap-0.5 py-3 first:pt-1 last:pb-0">
                  <p className="text-[17px] text-ink">
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
        <CardHeader className="px-5 pt-5 sm:px-6">
          <CardTitle>Upcoming lectures</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-5 sm:px-6">
          <p className="text-[13px] text-muted">
            Timetable integration is not enabled yet, so there are no upcoming lectures to show.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
