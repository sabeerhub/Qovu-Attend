/**
 * Session export (v0.14.0) — one tap downloads this session's
 * attendance as CSV, or opens the printable PDF report.
 *
 * The context the files are stamped with (department, course,
 * semester, lecturer, room) is loaded here through the same
 * assignment-scoped reads as the rest of the portal; the records
 * themselves come from the monitor, which already loaded them
 * through RLS. Nothing here can reach another lecturer's data.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  buildSessionReport,
  downloadTextFile,
  sessionCsvFilename,
  sessionRecordsToCsv,
  type SessionExportContext,
  type SessionReportData,
} from '@/lib/exports';
import { PrintReport } from './PrintReport';
import { Button } from '@/components/ui/button';
import type { AttendanceRecord, AttendanceSession } from '@/types/database';

type ContextState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; context: SessionExportContext };

interface CourseJoinRow {
  code: string;
  title: string;
  departments: { name: string } | null;
  semesters: { name: string; academic_sessions: { name: string } | null } | null;
}

export function SessionExport({
  session,
  records,
}: {
  session: AttendanceSession;
  /** Null while the monitor is still loading the records. */
  records: AttendanceRecord[] | null;
}) {
  const [contextState, setContextState] = useState<ContextState>({ status: 'loading' });
  const [printReport, setPrintReport] = useState<SessionReportData | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      try {
        const [courseRes, userRes] = await Promise.all([
          supabase
            .from('courses')
            .select('code, title, departments(name), semesters(name, academic_sessions(name))')
            .eq('id', session.course_id)
            .maybeSingle(),
          supabase.auth.getUser(),
        ]);
        if (courseRes.error) throw new Error(courseRes.error.message);
        const courseRow = (courseRes.data ?? null) as CourseJoinRow | null;

        let roomName: string | null = null;
        if (session.lecture_room_id) {
          const roomRes = await supabase
            .from('lecture_rooms')
            .select('name')
            .eq('id', session.lecture_room_id)
            .maybeSingle();
          if (!roomRes.error) {
            roomName = ((roomRes.data as { name: string } | null)?.name ?? null) as string | null;
          }
        }

        let lecturerName = '—';
        const uid = userRes.data.user?.id;
        if (uid) {
          const profileRes = await supabase
            .from('lecturer_profiles')
            .select('full_name')
            .eq('user_id', uid)
            .maybeSingle();
          if (!profileRes.error && profileRes.data) {
            lecturerName = (profileRes.data as { full_name: string }).full_name;
          }
        }

        if (cancelled) return;
        setContextState({
          status: 'ready',
          context: {
            departmentName: courseRow?.departments?.name ?? '—',
            courseCode: courseRow?.code ?? '—',
            courseTitle: courseRow?.title ?? '—',
            academicSessionName: courseRow?.semesters?.academic_sessions?.name ?? '—',
            semesterName: courseRow?.semesters?.name ?? '—',
            lecturerName,
            roomName,
          },
        });
      } catch (err: unknown) {
        if (!cancelled) {
          setContextState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load the export details.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.course_id, session.lecture_room_id]);

  const busy = contextState.status === 'loading' || records === null;

  function downloadCsv() {
    if (contextState.status !== 'ready' || records === null) return;
    downloadTextFile(
      sessionCsvFilename(contextState.context.courseCode, session),
      sessionRecordsToCsv(contextState.context, session, records),
      'text/csv;charset=utf-8',
    );
  }

  function printPdf() {
    if (contextState.status !== 'ready' || records === null) return;
    setPrintReport(buildSessionReport(contextState.context, session, records));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">
        Download this session&rsquo;s attendance as a spreadsheet file, or print it as a report
        to save as PDF.
      </p>
      {contextState.status === 'error' ? (
        <p className="text-[13px] text-danger" role="alert">
          {contextState.message}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={downloadCsv}
          className="w-full sm:w-auto"
        >
          {busy ? 'Loading…' : 'Download CSV'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={printPdf}
          className="w-full sm:w-auto"
        >
          {busy ? 'Loading…' : 'Print / Save as PDF'}
        </Button>
      </div>
      {printReport ? (
        <PrintReport report={printReport} onDone={() => setPrintReport(null)} />
      ) : null}
    </div>
  );
}
