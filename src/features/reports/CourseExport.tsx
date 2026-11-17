/**
 * Course export (v0.14.0) — a whole course as CSV (session-level
 * detail, one row per record per session) and as a printable PDF
 * summary (session list + per-student attended/held/%).
 *
 * The data loads here through the same assignment-scoped queries
 * as the Eligibility screen (sessions + records for this course
 * only, class list for this course only), and the summary reuses
 * the eligibility computation itself — so the PDF can never
 * disagree with the Eligibility screen. Nothing here can reach
 * another lecturer's data: the course is one the lecturer is
 * assigned to, and every query is RLS-scoped.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AssignedCourse } from '@/hooks/useAssignments';
import {
  buildCourseReport,
  courseCsvFilename,
  courseRecordsToCsv,
  downloadTextFile,
  type CourseReportData,
  type ExportRecord,
  type ExportSession,
} from '@/lib/exports';
import { PrintReport } from './PrintReport';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { EligibilitySkeleton } from '@/components/ui/skeleton';

type CourseExportState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; report: CourseReportData; csv: string };

export function CourseExport({
  course,
  lecturerName,
  onBack,
}: {
  course: AssignedCourse;
  lecturerName: string;
  onBack: () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<CourseExportState>({ status: 'loading' });
  const [printReport, setPrintReport] = useState<CourseReportData | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from('attendance_sessions')
          .select('id, title, lecture_date, week_number, status, headcount')
          .eq('course_id', course.id)
          .order('lecture_date', { ascending: true });
        if (sessionError) throw new Error(sessionError.message);
        const sessions = (sessionData ?? []) as ExportSession[];
        const sessionIds = sessions.map((s) => s.id);

        const [recordRes, studentRes] = await Promise.all([
          sessionIds.length > 0
            ? supabase
                .from('attendance_records')
                .select(
                  'session_id, registration_number, student_name, status, verification_method, submitted_at, manual_reason',
                )
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

        const records = (recordRes.data ?? []) as Array<ExportRecord & { session_id: string }>;
        const students = (studentRes.data ?? []) as Array<{
          reg_number: string;
          student_name: string | null;
        }>;
        const context = {
          departmentName: course.departmentName,
          courseCode: course.code,
          courseTitle: course.title,
          academicSessionName: course.academicSessionName,
          semesterName: course.semesterName,
        };
        const report = buildCourseReport(
          {
            ...context,
            code: course.code,
            title: course.title,
            lecturerName,
            threshold: course.eligibility_threshold,
          },
          sessions,
          records,
          students,
        );
        if (!cancelled) {
          setState({ status: 'ready', report, csv: courseRecordsToCsv(context, sessions, records) });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load the export.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // The course is fixed for this view; the lecturer name comes
    // from the caller's assignment data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id, refreshKey]);

  function downloadCsv() {
    if (state.status !== 'ready') return;
    downloadTextFile(courseCsvFilename(course.code), state.csv, 'text/csv;charset=utf-8');
  }

  function printPdf() {
    if (state.status !== 'ready') return;
    setPrintReport(state.report);
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
        <h3 className="text-[17px] font-semibold text-ink">Exports</h3>
        <p className="text-[13px] text-muted">
          The spreadsheet file keeps every session&rsquo;s detail, one row per student per
          session. The printed report is the summary: the session list and each
          student&rsquo;s attended, held and percentage.
        </p>

        {state.status === 'loading' ? <EligibilitySkeleton /> : null}
        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => setRefreshKey((k) => k + 1)} />
        ) : null}

        {state.status === 'ready' ? (
          state.report.totalSessions === 0 ? (
            <EmptyState
              title="No sessions yet"
              description="Exports appear after the first session is created for this course."
            />
          ) : (
            <>
              <p className="text-[13px] text-muted">
                {state.report.totalSessions} session{state.report.totalSessions === 1 ? '' : 's'} ·{' '}
                {state.report.heldSessions} finished · {state.report.rows.length} student
                {state.report.rows.length === 1 ? '' : 's'} · bar {course.eligibility_threshold}%
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={downloadCsv}
                  className="w-full sm:w-auto"
                >
                  Download CSV
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
          )
        ) : null}
      </section>

      {printReport ? (
        <PrintReport report={printReport} onDone={() => setPrintReport(null)} />
      ) : null}
    </div>
  );
}
