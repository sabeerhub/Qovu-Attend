/**
 * Analytics (v0.15.0) — how attendance looks across ALL the
 * lecturer's courses, the Nigerian-universities way.
 *
 * Course first, names second: each course is one summary row
 * (sessions finished, weeks covered, average turnout, how many
 * students are safe / close / below the bar). The detail — the
 * week-by-week grid, the at-risk list, the sessions to review —
 * opens underneath a course.
 *
 * The at-risk list is the department list: students below the
 * bar and close to it, ready to download as CSV or print as a
 * PDF (the v0.14.0 export machinery) and hand to the head of
 * department about two weeks before exams. The lecturer and the
 * head of department decide who writes the exam — this screen
 * never bans anyone, and nothing here predicts anything.
 *
 * Everything loads through the same assignment-scoped queries
 * (and RLS) as the rest of the portal — only the signed-in
 * lecturer's own courses, sessions and records. Three queries
 * total (sessions, records, class lists), all filtered by the
 * lecturer's assignments.
 *
 * Honest limit: the records for all assigned courses load at
 * once, client-side. That is fine at the scale Qovu runs at
 * today; if a lecturer's data ever grows very large, the next
 * step is a server-side summary — not loading more here.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAssignments, type AssignedCourse } from '@/hooks/useAssignments';
import {
  atRiskRows,
  computeCourseAnalytics,
  type AnalyticsRecord,
  type AnalyticsSession,
  type AnalyticsStudent,
  type CourseAnalytics,
} from '@/lib/analytics';
import {
  atRiskCsvFilename,
  atRiskRowsToCsv,
  buildAtRiskReport,
  downloadTextFile,
  formatPercentage,
  type AtRiskReportData,
} from '@/lib/exports';
import { PrintReport } from '@/features/reports/PrintReport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { EligibilitySkeleton } from '@/components/ui/skeleton';

type AnalyticsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; analytics: CourseAnalytics[] };

function bandDot(band: 'safe' | 'approaching' | 'below'): string {
  if (band === 'safe') return 'bg-success';
  if (band === 'approaching') return 'bg-warning';
  return 'bg-danger';
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function CourseDetail({
  course,
  analytics,
  lecturerName,
}: {
  course: AssignedCourse;
  analytics: CourseAnalytics;
  lecturerName: string;
}) {
  const [printReport, setPrintReport] = useState<AtRiskReportData | null>(null);
  const atRisk = atRiskRows(analytics.rows);
  const below = analytics.rows.filter((row) => row.band === 'below');
  const approaching = analytics.rows.filter((row) => row.band === 'approaching');

  function downloadCsv() {
    downloadTextFile(
      atRiskCsvFilename(course.code),
      atRiskRowsToCsv(
        { code: course.code, title: course.title, departmentName: course.departmentName },
        analytics.rows,
      ),
      'text/csv;charset=utf-8',
    );
  }

  function printPdf() {
    setPrintReport(
      buildAtRiskReport(
        {
          code: course.code,
          title: course.title,
          departmentName: course.departmentName,
          semesterName: course.semesterName,
          academicSessionName: course.academicSessionName,
          lecturerName,
          threshold: course.eligibility_threshold,
        },
        analytics.rows,
        analytics.heldSessions,
        analytics.totalSessions,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-6 border-t border-line pt-4">
      {/* Week by week — which weeks had a session, and how many
          students came. A week with no finished session shows a
          dash: a strike-disrupted semester stays visible. */}
      <section className="flex flex-col gap-2">
        <h4 className="text-[15px] font-semibold text-ink">Week by week</h4>
        <div className="flex flex-wrap gap-1.5">
          {analytics.weekly.map((week) => (
            <div
              key={week.week}
              className="flex w-[52px] flex-col items-center rounded-lg border border-line px-1 py-2"
            >
              <span className="text-[11px] font-medium text-muted">W{week.week}</span>
              <span className="text-[15px] font-semibold text-ink">
                {week.heldSessions === 0 ? '—' : week.presentStudents}
              </span>
              <span className="text-[11px] text-faint">
                {week.heldSessions === 0
                  ? 'no session'
                  : `${week.heldSessions} held`}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[13px] text-muted">
          Students present in each week, counting only finished sessions. A dash means no
          finished session that week.
        </p>
      </section>

      {/* The at-risk list — the department list. */}
      <section className="flex flex-col gap-3">
        <h4 className="text-[15px] font-semibold text-ink">Students at risk</h4>
        {analytics.heldSessions === 0 ? (
          <p className="text-[13px] text-muted">
            No finished sessions yet — the at-risk list appears after the first session is
            finalized.
          </p>
        ) : atRisk.length === 0 ? (
          <p className="text-[13px] text-muted">
            Nobody is below or close to the bar in this course.
          </p>
        ) : (
          <>
            <p className="text-[13px] text-muted">
              {below.length} below the bar · {approaching.length} close to the bar. This is
              the list for the department, about two weeks before exams — the lecturer and
              the head of department decide who writes the exam. This screen never bans
              anyone.
            </p>
            <div className="flex flex-col">
              {atRisk.map((row) => (
                <div
                  key={row.regNumber}
                  className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-[17px] text-ink">
                      {row.regNumber}
                      {row.studentName ? ` · ${row.studentName}` : ''}
                    </p>
                    <p className="text-[13px] text-muted">
                      Attended {row.attended} of {row.held} · {formatPercentage(row.percentage)}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-muted">
                    <span
                      aria-hidden="true"
                      className={`inline-block h-1.5 w-1.5 rounded-full ${bandDot(row.band ?? 'below')}`}
                    />
                    {row.band === 'below' ? 'Below the bar' : 'Close to the bar'}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="secondary"
                onClick={downloadCsv}
                className="w-full sm:w-auto"
              >
                Download at-risk list (CSV)
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={printPdf}
                className="w-full sm:w-auto"
              >
                Print / Save as PDF
              </Button>
            </div>
          </>
        )}
      </section>

      {/* Sessions to review — flags only, never a verdict. */}
      <section className="flex flex-col gap-3">
        <h4 className="text-[15px] font-semibold text-ink">Sessions to review</h4>
        <p className="text-[13px] text-muted">
          A difference or a flag is a number to review — it is not automatic evidence of
          fraud.
        </p>
        {analytics.reviewSessions.length === 0 ? (
          <p className="text-[13px] text-muted">
            Nothing to review in this course — no shared devices, no shared faces, no
            headcount differences.
          </p>
        ) : (
          <div className="flex flex-col">
            {analytics.reviewSessions.map((review) => (
              <div
                key={review.sessionId}
                className="flex flex-col gap-1 border-b border-line py-3 last:border-b-0"
              >
                <p className="text-[17px] text-ink">
                  {review.title} · Week {review.weekNumber}
                </p>
                <p className="text-[13px] text-muted">
                  {formatDate(review.lectureDate)} · {review.totalRecords} submission
                  {review.totalRecords === 1 ? '' : 's'}
                </p>
                <p className="text-[13px] text-ink">
                  {[
                    review.faceFlags > 0
                      ? `Same face flagged on ${review.faceFlags} record${review.faceFlags === 1 ? '' : 's'}`
                      : null,
                    review.reusedDevices > 0
                      ? `${review.reusedDevices} device${review.reusedDevices === 1 ? '' : 's'} used for more than one number`
                      : null,
                    review.sameFace > 0
                      ? `${review.sameFace} face${review.sameFace === 1 ? '' : 's'} used for more than one number`
                      : null,
                    review.headcountDifference !== null && review.headcountDifference !== 0
                      ? `Headcount ${review.headcount}, ${review.totalRecords} submissions (${review.headcountDifference > 0 ? `${review.headcountDifference} fewer` : `${-review.headcountDifference} more`})`
                      : null,
                  ]
                    .filter((part): part is string => part !== null)
                    .join(' · ')}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {printReport ? (
        <PrintReport report={printReport} onDone={() => setPrintReport(null)} />
      ) : null}
    </div>
  );
}

export function AnalyticsScreen() {
  const assignments = useAssignments();
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<AnalyticsState>({ status: 'loading' });
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (assignments.status !== 'ready') return;
    if (!supabase) return;
    const { courses } = assignments.data;
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const courseIds = courses.map((c) => c.id);
        if (courseIds.length === 0) {
          if (!cancelled) setState({ status: 'ready', analytics: [] });
          return;
        }
        const { data: sessionData, error: sessionError } = await supabase
          .from('attendance_sessions')
          .select('id, course_id, title, lecture_date, week_number, status, headcount')
          .in('course_id', courseIds)
          .order('lecture_date', { ascending: true });
        if (sessionError) throw new Error(sessionError.message);
        const sessions = (sessionData ?? []) as AnalyticsSession[];
        const sessionIds = sessions.map((s) => s.id);

        const [recordRes, studentRes] = await Promise.all([
          sessionIds.length > 0
            ? supabase
                .from('attendance_records')
                .select(
                  'session_id, registration_number, status, device_fingerprint_hash, selfie_hash, face_review',
                )
                .in('session_id', sessionIds)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from('course_students')
            .select('course_id, reg_number, student_name')
            .in('course_id', courseIds)
            .order('reg_number'),
        ]);
        if (recordRes.error) throw new Error(recordRes.error.message);
        if (studentRes.error) throw new Error(studentRes.error.message);

        const records = (recordRes.data ?? []) as AnalyticsRecord[];
        const students = (studentRes.data ?? []) as Array<AnalyticsStudent & { course_id: string }>;
        const courseIdBySessionId = new Map(sessions.map((s) => [s.id, s.course_id]));

        const analytics = courses.map((course) =>
          computeCourseAnalytics({
            courseId: course.id,
            sessions: sessions.filter((s) => s.course_id === course.id),
            records: records.filter(
              (r) => courseIdBySessionId.get(r.session_id) === course.id,
            ),
            students: students
              .filter((s) => s.course_id === course.id)
              .map((s) => ({ reg_number: s.reg_number, student_name: s.student_name })),
            threshold: course.eligibility_threshold,
          }),
        );
        if (!cancelled) setState({ status: 'ready', analytics });
      } catch (err: unknown) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load analytics.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-run when the assignments load or the lecturer retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments.status, refreshKey]);

  if (assignments.status === 'not-configured') {
    return (
      <EmptyState
        title="Supabase is not configured yet"
        description="Supabase is not connected yet."
      />
    );
  }
  if (assignments.status === 'loading') return <EligibilitySkeleton />;
  if (assignments.status === 'error') {
    return <ErrorState message={assignments.message} />;
  }
  if (assignments.status === 'no-profile') {
    return (
      <EmptyState
        title="No lecturer profile found"
        description="Your account has no lecturer profile yet. Ask your university administrator to create one for your account."
      />
    );
  }

  const { courses, profile } = assignments.data;
  const courseById = new Map(courses.map((c) => [c.id, c]));

  if (state.status === 'loading') return <EligibilitySkeleton />;
  if (state.status === 'error') {
    return (
      <ErrorState message={state.message} onRetry={() => setRefreshKey((k) => k + 1)} />
    );
  }

  const totalHeld = state.analytics.reduce((sum, a) => sum + a.heldSessions, 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        How attendance looks across all your courses. Only finished sessions count — a
        session still open can still change.
      </p>

      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="You have no courses yet. Create your first course — it will be assigned to you."
        />
      ) : (
        <>
          <p className="text-[13px] text-muted">
            {courses.length} course{courses.length === 1 ? '' : 's'} · {totalHeld} session
            {totalHeld === 1 ? '' : 's'} finished
          </p>
          <div className="flex flex-col gap-4">
            {state.analytics.map((analytics) => {
              const course = courseById.get(analytics.courseId);
              if (!course) return null;
              const expanded = expandedCourseId === course.id;
              return (
                <Card key={course.id}>
                  <CardHeader>
                    <CardTitle>
                      {course.code} — {course.title}
                    </CardTitle>
                    <p className="text-[13px] font-normal text-muted">
                      {course.departmentName} · {course.semesterName} · Bar{' '}
                      {course.eligibility_threshold}%
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {analytics.totalSessions === 0 ? (
                      <p className="text-[13px] text-muted">
                        No sessions yet for this course.
                      </p>
                    ) : (
                      <>
                        <p className="text-[15px] text-ink">
                          {analytics.heldSessions} of {analytics.totalSessions} sessions
                          finished · {analytics.weeksCovered} of 15 weeks had a session
                          {analytics.averageTurnout !== null
                            ? ` · Average turnout ${analytics.averageTurnout.toFixed(1)}%`
                            : ''}
                        </p>
                        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                          <span className="flex items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className="inline-block h-1.5 w-1.5 rounded-full bg-success"
                            />
                            Safe {analytics.bandCounts.safe}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className="inline-block h-1.5 w-1.5 rounded-full bg-warning"
                            />
                            Close to the bar {analytics.bandCounts.approaching}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className="inline-block h-1.5 w-1.5 rounded-full bg-danger"
                            />
                            Below the bar {analytics.bandCounts.below}
                          </span>
                        </p>
                      </>
                    )}
                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setExpandedCourseId(expanded ? null : course.id)
                        }
                      >
                        {expanded ? 'Hide detail' : 'View detail'}
                      </Button>
                    </div>
                    {expanded ? (
                      <CourseDetail
                        course={course}
                        analytics={analytics}
                        lecturerName={profile.full_name}
                      />
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
