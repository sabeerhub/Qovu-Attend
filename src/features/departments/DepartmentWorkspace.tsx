import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AssignedCourse, AssignedDepartment } from '@/hooks/useAssignments';
import type { SessionStatus } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { ErrorState, LoadingState } from '@/components/ui/empty-state';

interface DepartmentSessionRow {
  id: string;
  title: string;
  lecture_date: string;
  week_number: number;
  status: SessionStatus;
  courses: { code: string } | null;
}

/**
 * One department's workspace (spec §4): faculty name, the assigned
 * courses in this department, its academic session(s), and
 * department-filtered statistics and session history — all from real
 * queries scoped to this department's assigned courses.
 */
export function DepartmentWorkspace({
  department,
  courses,
  onBack,
}: {
  department: AssignedDepartment;
  courses: AssignedCourse[];
  onBack: () => void;
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; sessions: DepartmentSessionRow[]; recordCount: number }
  >({ status: 'loading' });

  const courseIds = courses.map((c) => c.id);
  const academicSessions = [...new Set(courses.map((c) => c.academicSessionName))];

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      try {
        const sessionRes =
          courseIds.length > 0
            ? await supabase
                .from('attendance_sessions')
                .select('id, title, lecture_date, week_number, status, courses(code)')
                .in('course_id', courseIds)
                .order('lecture_date', { ascending: false })
            : { data: [] as DepartmentSessionRow[], error: null };
        if (sessionRes.error) throw new Error(sessionRes.error.message);
        const sessions = (sessionRes.data ?? []) as DepartmentSessionRow[];
        const sessionIds = sessions.map((s) => s.id);
        const recordRes =
          sessionIds.length > 0
            ? await supabase
                .from('attendance_records')
                .select('id', { count: 'exact', head: true })
                .in('session_id', sessionIds)
            : { count: 0, error: null };
        if (recordRes.error) throw new Error(recordRes.error.message);
        if (!cancelled) {
          setState({ status: 'ready', sessions, recordCount: recordRes.count ?? 0 });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load this department.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // courseIds is derived from the courses prop; re-run if it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department.id]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        <Button variant="secondary" onClick={onBack}>
          Back to departments
        </Button>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{department.name}</h2>
        <p className="text-[13px] text-muted">
          {department.facultyName ?? 'No faculty recorded'}
          {department.code ? ` · ${department.code}` : ''}
          {academicSessions.length > 0 ? ` · ${academicSessions.join(', ')}` : ''}
        </p>
      </div>

      {state.status === 'loading' ? <LoadingState label="Loading department…" /> : null}
      {state.status === 'error' ? <ErrorState message={state.message} /> : null}
      {state.status === 'ready' ? (
        <>
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {[
              { label: 'Assigned courses', value: courses.length },
              { label: 'Attendance sessions', value: state.sessions.length },
              { label: 'Attendance records', value: state.recordCount },
            ].map((item) => (
              <Card key={item.label}>
                <CardHeader className="px-4 pt-4 sm:px-6 sm:pt-5">
                  <CardTitle className="text-[13px] font-normal text-muted">{item.label}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:py-5">
                  <p className="text-[28px] font-semibold leading-none text-ink">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Assigned courses</CardTitle>
            </CardHeader>
            <CardContent>
              {courses.length === 0 ? (
                <p className="text-[13px] text-muted">
                  No courses assigned in this department yet.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {courses.map((course) => (
                    <li key={course.id} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
                      <p className="text-[15px] text-ink">
                        {course.code} — {course.title}
                      </p>
                      <p className="text-[13px] text-muted">
                        Level {course.level} · {course.semesterName} · {course.academicSessionName}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session history</CardTitle>
            </CardHeader>
            <CardContent>
              {state.sessions.length === 0 ? (
                <p className="text-[13px] text-muted">
                  No attendance sessions in this department yet.
                </p>
              ) : (
                <>
                  {/* Phones (v0.13.0): stacked cards instead of a
                      five-column table — title, meta and status,
                      nothing clipped. The table stays on desktop. */}
                  <ul className="flex flex-col divide-y divide-line md:hidden">
                    {state.sessions.map((session) => (
                      <li
                        key={session.id}
                        className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
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
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.sessions.map((session) => (
                        <tr key={session.id} className="border-b border-line last:border-b-0">
                          <td className="py-3 pr-4 text-ink">{session.title}</td>
                          <td className="py-3 pr-4 text-muted">{session.courses?.code ?? '—'}</td>
                          <td className="py-3 pr-4 text-muted">Week {session.week_number}</td>
                          <td className="py-3 pr-4 text-muted">{session.lecture_date}</td>
                          <td className="py-3">
                            <StatusBadge status={session.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
