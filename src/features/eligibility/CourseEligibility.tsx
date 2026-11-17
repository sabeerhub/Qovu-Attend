import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AssignedCourse } from '@/hooks/useAssignments';
import {
  computeEligibility,
  DEFAULT_ELIGIBILITY_THRESHOLD,
  setEligibilityThreshold,
  validateThreshold,
  type EligibilityRecord,
  type EligibilityRow,
  type EligibilitySession,
  type EligibilityStudent,
} from '@/lib/eligibility';
import { STUDENTS_PAGE_SIZE } from '@/lib/students';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { EligibilitySkeleton } from '@/components/ui/skeleton';

type EligibilityState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rows: EligibilityRow[]; held: number };

/**
 * Eligibility inside one course: who can write the exam.
 *
 * Attendance % = sessions attended ÷ sessions actually held. Only
 * finished sessions (Finalized or Archived) count as held — Draft,
 * Active and Closed sessions do not count yet, because attendance
 * can still change in them. A student added by hand counts as
 * present, the same as a verified one; pending does not count.
 * The exact, unrounded percentage decides: 74.6% is below a 75%
 * bar.
 *
 * Bands (they move with the bar): below the bar; close to the bar
 * (the bar up to 9 points above it); safe (10 or more points above
 * the bar). The bar itself is changed here and saved through the
 * server-side `set_eligibility_threshold` RPC, which refuses any
 * course the lecturer is not assigned to.
 *
 * Only the lecturer's own data ever loads here (RLS); another
 * lecturer's course is never visible.
 */
export function CourseEligibility({
  course,
  onBack,
}: {
  course: AssignedCourse;
  onBack: () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<EligibilityState>({ status: 'loading' });
  const [page, setPage] = useState(0);
  const [threshold, setThreshold] = useState(
    course.eligibility_threshold ?? DEFAULT_ELIGIBILITY_THRESHOLD,
  );
  const [thresholdInput, setThresholdInput] = useState(
    String(course.eligibility_threshold ?? DEFAULT_ELIGIBILITY_THRESHOLD),
  );
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from('attendance_sessions')
          .select('id, week_number, status')
          .eq('course_id', course.id)
          .order('lecture_date', { ascending: true });
        if (sessionError) throw new Error(sessionError.message);
        const sessions = (sessionData ?? []) as EligibilitySession[];
        const sessionIds = sessions.map((s) => s.id);

        const [recordRes, studentRes] = await Promise.all([
          sessionIds.length > 0
            ? supabase
                .from('attendance_records')
                .select('session_id, registration_number, status')
                .in('session_id', sessionIds)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from('course_students')
            .select('reg_number, student_name')
            .eq('course_id', course.id)
            .order('reg_number'),
        ]);
        if (recordRes.error) throw new Error(recordRes.error.message);
        if (studentRes.error) throw new Error(studentRes.error.message);

        const rows = computeEligibility({
          sessions,
          records: (recordRes.data ?? []) as EligibilityRecord[],
          students: (studentRes.data ?? []) as EligibilityStudent[],
          threshold,
        });
        const held = sessions.filter((s) => s.status === 'finalized' || s.status === 'archived')
          .length;
        if (!cancelled) setState({ status: 'ready', rows, held });
      } catch (err: unknown) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load eligibility.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // The threshold is applied when the rows are computed; changing
    // it re-runs the load so the bands move with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, refreshKey, threshold]);

  const rows = state.status === 'ready' ? state.rows : [];
  const held = state.status === 'ready' ? state.held : 0;
  const pageCount = Math.max(1, Math.ceil(rows.length / STUDENTS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(
    safePage * STUDENTS_PAGE_SIZE,
    safePage * STUDENTS_PAGE_SIZE + STUDENTS_PAGE_SIZE,
  );

  async function saveThreshold() {
    const value = Number(thresholdInput);
    const error = validateThreshold(Number.isNaN(value) ? thresholdInput : value);
    if (error) {
      setThresholdError(error);
      return;
    }
    if (!supabase) return;
    setThresholdError(null);
    setActionMessage(null);
    setSavingThreshold(true);
    const result = await setEligibilityThreshold(supabase, course.id, value);
    setSavingThreshold(false);
    if ('error' in result) {
      setThresholdError(result.error);
      return;
    }
    setThreshold(result.threshold);
    setThresholdInput(String(result.threshold));
    setActionMessage(`The bar is now ${result.threshold}%.`);
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button type="button" variant="ghost" onClick={onBack} className="self-start px-0">
          ← All courses
        </Button>
        <h2 className="text-[17px] font-semibold text-ink">
          {course.code} — {course.title}
        </h2>
        <p className="text-[13px] text-muted">
          {course.departmentName} · {course.semesterName} · Level {course.level}
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h3 className="text-[17px] font-semibold text-ink">Eligibility</h3>
        <p className="text-[13px] text-muted">
          Attendance % = sessions attended ÷ finished sessions. Only finished sessions count.
          A student added by hand counts as present. The exact percentage decides — 74.6% is
          below a 75% bar.
        </p>

        {actionMessage ? (
          <p className="text-[13px] text-success" role="status">
            {actionMessage}
          </p>
        ) : null}

        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <label className="flex max-w-xs flex-col gap-1.5 text-[13px] font-medium text-ink">
              Attendance bar (%)
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                aria-label="Attendance bar in percent"
              />
            </label>
            {thresholdError ? <p className="text-[13px] text-danger">{thresholdError}</p> : null}
            <div>
              <Button type="button" disabled={savingThreshold} onClick={() => void saveThreshold()}>
                {savingThreshold ? 'Saving…' : 'Save bar'}
              </Button>
            </div>
            <p className="text-[13px] text-muted">
              Students below the bar are not eligible to write the exam. Close to the bar means
              the bar up to 9 points above it; safe means 10 or more points above the bar.
            </p>
          </CardContent>
        </Card>

        {state.status === 'loading' ? <EligibilitySkeleton /> : null}
        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => setRefreshKey((k) => k + 1)} />
        ) : null}

        {state.status === 'ready' ? (
          held === 0 ? (
            <EmptyState
              title="No finished sessions yet"
              description="Eligibility appears after the first session is finalized. Draft, active and closed sessions do not count yet."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No students yet"
              description="Add students to this course’s class list, or wait for the first attendance submissions."
            />
          ) : (
            <>
              <p className="text-[13px] text-muted">
                {rows.length} student{rows.length === 1 ? '' : 's'} · {held} finished session
                {held === 1 ? '' : 's'} · bar {threshold}%
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-[12px] font-medium uppercase text-muted">
                      <th className="py-2 pr-4">Student</th>
                      <th className="py-2 pr-4">Attended</th>
                      <th className="py-2 pr-4">Percentage</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2">Weeks 1–15</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr key={row.regNumber} className="border-b border-line last:border-b-0">
                        <td className="py-3 pr-4">
                          <span className="block text-sm text-ink">{row.regNumber}</span>
                          {row.studentName ? (
                            <span className="block text-[13px] text-muted">{row.studentName}</span>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4 text-sm text-ink">
                          {row.attended} of {row.held}
                        </td>
                        <td className="py-3 pr-4 text-sm text-ink">
                          {row.percentage === null ? '—' : `${row.percentage.toFixed(1)}%`}
                        </td>
                        <td className="py-3 pr-4 text-sm">
                          {row.band === 'below' ? (
                            <span className="inline-flex items-center gap-1.5 text-danger">
                              <span
                                aria-hidden="true"
                                className="inline-block h-1.5 w-1.5 rounded-full bg-danger"
                              />
                              Below the bar
                            </span>
                          ) : row.band === 'approaching' ? (
                            <span className="inline-flex items-center gap-1.5 text-warning">
                              <span
                                aria-hidden="true"
                                className="inline-block h-1.5 w-1.5 rounded-full bg-warning"
                              />
                              Close to the bar
                            </span>
                          ) : row.band === 'safe' ? (
                            <span className="inline-flex items-center gap-1.5 text-success">
                              <span
                                aria-hidden="true"
                                className="inline-block h-1.5 w-1.5 rounded-full bg-success"
                              />
                              Safe
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className="flex gap-1" aria-label="Week by week attendance">
                            {row.weeks.map((week, i) => (
                              <span
                                key={i}
                                title={
                                  week === 'attended'
                                    ? `Week ${i + 1}: attended`
                                    : week === 'missed'
                                      ? `Week ${i + 1}: missed`
                                      : `Week ${i + 1}: no session`
                                }
                                className={
                                  week === 'attended'
                                    ? 'inline-flex h-5 w-5 items-center justify-center rounded text-[12px] font-medium text-success'
                                    : week === 'missed'
                                      ? 'inline-flex h-5 w-5 items-center justify-center rounded text-[12px] font-medium text-danger'
                                      : 'inline-flex h-5 w-5 items-center justify-center rounded text-[12px] text-faint'
                                }
                              >
                                {week === 'attended' ? '✓' : week === 'missed' ? '✗' : '–'}
                              </span>
                            ))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[13px] text-muted">
                Weeks: ✓ attended · ✗ missed · – no session that week.
              </p>
              {pageCount > 1 ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] text-muted">
                    Showing {safePage * STUDENTS_PAGE_SIZE + 1}–
                    {Math.min((safePage + 1) * STUDENTS_PAGE_SIZE, rows.length)} of {rows.length}
                  </p>
                  <span className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={safePage === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={safePage >= pageCount - 1}
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    >
                      Next
                    </Button>
                  </span>
                </div>
              ) : null}
            </>
          )
        ) : null}
      </section>
    </div>
  );
}
