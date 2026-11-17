/**
 * Printable reports (v0.14.0) — the PDF side of exports.
 *
 * There is no PDF library and no PDF file: the report is a
 * print-only node (`.print-report`, hidden on screen, the only
 * thing printed — see the print block in src/styles/globals.css)
 * rendered with A4 `@page` CSS. The lecturer prints it or saves
 * it as PDF from the browser's print dialog.
 *
 * The print view opens the browser print dialog as soon as it
 * mounts, and reports back through `onDone` when the dialog
 * closes (including when the lecturer cancels) so the caller can
 * unmount it. Page numbers come from the print engine's
 * `counter(page)` — Chrome and Edge show them; other browsers
 * show the footer without the numbers.
 *
 * The header is honest: no university name or logo is configured
 * anywhere in Qovu, so it shows the Qovu brand plus the real
 * department, course, session, date and lecturer name. A
 * university name/logo setting is still an open question for the
 * owner — nothing is invented here.
 */
import { useEffect } from 'react';
import {
  bandLabel,
  formatPercentage,
  methodLabel,
  statusLabel,
  type AtRiskReportData,
  type CourseReportData,
  type ReportData,
  type SessionReportData,
} from '@/lib/exports';

/** The Q mark, inline SVG — print-safe (no external image fetch). */
function PrintMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 64 64"
      role="img"
      aria-label="Qovu"
      className="shrink-0"
    >
      <circle cx="28" cy="28" r="19" fill="none" stroke="#111111" strokeWidth="6" />
      <line x1="41" y1="41" x2="51" y2="53" stroke="#111111" strokeWidth="6" strokeLinecap="round" />
      <circle cx="28" cy="28" r="5.5" fill="#0071e3" />
    </svg>
  );
}

function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })} · ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatSubmittedAt(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })} ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-line align-top">
      <td className="w-40 py-2 pr-4 text-muted">{label}</td>
      <td className="py-2 text-ink">{value}</td>
    </tr>
  );
}

function SignatureArea() {
  return (
    <div className="mt-10">
      <h3 className="text-[14px] font-semibold text-ink">Signature</h3>
      <div className="mt-6 flex gap-12">
        <div className="flex-1">
          <p className="text-[12px] text-muted">Lecturer&rsquo;s signature</p>
          <div className="print-signature-line" />
        </div>
        <div className="flex-1">
          <p className="text-[12px] text-muted">Date</p>
          <div className="print-signature-line" />
        </div>
      </div>
    </div>
  );
}

function SessionPrint({ report }: { report: SessionReportData }) {
  const { session, context, summary } = report;
  return (
    <div>
      <h2 className="mt-6 text-[20px] font-semibold text-ink">{session.title}</h2>
      <p className="mt-1 text-[13px] text-muted">
        Attendance report · {context.courseCode} — {context.courseTitle}
      </p>

      <table className="mt-6 w-full text-left text-[13px]">
        <tbody>
          <MetaRow label="Department" value={context.departmentName} />
          <MetaRow label="Course" value={`${context.courseCode} — ${context.courseTitle}`} />
          <MetaRow label="Academic session" value={context.academicSessionName} />
          <MetaRow label="Semester" value={context.semesterName} />
          <MetaRow label="Week" value={`Week ${session.week_number}`} />
          <MetaRow
            label="Date"
            value={
              session.start_time
                ? `${formatDate(session.lecture_date)} · ${session.start_time}`
                : formatDate(session.lecture_date)
            }
          />
          <MetaRow label="Room" value={context.roomName ?? '—'} />
          <MetaRow label="Lecturer" value={context.lecturerName} />
          <MetaRow
            label="Physical headcount"
            value={session.headcount === null ? '—' : String(session.headcount)}
          />
          <MetaRow label="Status" value={statusLabel(session.status)} />
        </tbody>
      </table>

      <h3 className="mt-8 text-[14px] font-semibold text-ink">Summary</h3>
      <p className="mt-2 text-[13px] text-ink">
        Verified {summary.verified} · Manual {summary.manual} · Pending {summary.pending} ·
        Rejected {summary.rejected} · Suspicious {summary.suspicious} · Total {summary.total}
      </p>
      <p className="mt-1 text-[13px] text-muted">
        {report.difference === null
          ? 'No physical headcount was recorded for this session, so no difference can be shown.'
          : `Headcount ${session.headcount} minus ${summary.total} submissions is ${report.difference}. A difference is a number to review — it is not automatic evidence of fraud.`}
      </p>

      <h3 className="mt-8 text-[14px] font-semibold text-ink">Attendance</h3>
      {report.rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">This session has no attendance records.</p>
      ) : (
        <table className="mt-2 w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase text-muted">
              <th className="py-2 pr-3 font-medium">Registration number</th>
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Method</th>
              <th className="py-2 pr-3 font-medium">Submitted</th>
              <th className="py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={`${row.registration_number}-${row.submitted_at}`} className="border-b border-line">
                <td className="py-2 pr-3 text-ink">{row.registration_number}</td>
                <td className="py-2 pr-3 text-ink">{row.student_name ?? '—'}</td>
                <td className="py-2 pr-3 text-ink">{statusLabel(row.status)}</td>
                <td className="py-2 pr-3 text-ink">{methodLabel(row.verification_method)}</td>
                <td className="py-2 pr-3 text-ink">{formatSubmittedAt(row.submitted_at)}</td>
                <td className="py-2 text-ink">{row.manual_reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <SignatureArea />
    </div>
  );
}

function CoursePrint({ report }: { report: CourseReportData }) {
  const { course } = report;
  return (
    <div>
      <h2 className="mt-6 text-[20px] font-semibold text-ink">
        {course.code} — {course.title}
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        Attendance summary · {course.departmentName} · {course.semesterName} ·{' '}
        {course.academicSessionName}
      </p>

      <table className="mt-6 w-full text-left text-[13px]">
        <tbody>
          <MetaRow label="Department" value={course.departmentName} />
          <MetaRow label="Course" value={`${course.code} — ${course.title}`} />
          <MetaRow label="Academic session" value={course.academicSessionName} />
          <MetaRow label="Semester" value={course.semesterName} />
          <MetaRow label="Lecturer" value={course.lecturerName} />
          <MetaRow label="Attendance bar" value={`${course.threshold}%`} />
          <MetaRow
            label="Sessions held"
            value={`${report.heldSessions} of ${report.totalSessions} finished`}
          />
        </tbody>
      </table>

      <h3 className="mt-8 text-[14px] font-semibold text-ink">Sessions</h3>
      {report.sessions.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">This course has no sessions yet.</p>
      ) : (
        <table className="mt-2 w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase text-muted">
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">Week</th>
              <th className="py-2 pr-3 font-medium">Title</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Headcount</th>
              <th className="py-2 font-medium">Present</th>
            </tr>
          </thead>
          <tbody>
            {report.sessions.map((s) => (
              <tr key={s.id} className="border-b border-line">
                <td className="py-2 pr-3 text-ink">{formatDate(s.lecture_date)}</td>
                <td className="py-2 pr-3 text-ink">Week {s.week_number}</td>
                <td className="py-2 pr-3 text-ink">{s.title}</td>
                <td className="py-2 pr-3 text-ink">{statusLabel(s.status)}</td>
                <td className="py-2 pr-3 text-ink">{s.headcount === null ? '—' : String(s.headcount)}</td>
                <td className="py-2 text-ink">{s.present}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="mt-8 text-[14px] font-semibold text-ink">Students</h3>
      <p className="mt-1 text-[13px] text-muted">
        Only finished sessions (Finalized or Archived) count as held. A student added by hand
        counts as present. The exact percentage decides — 74.6% is below a 75% bar.
      </p>
      {report.rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">This course has no students yet.</p>
      ) : (
        <table className="mt-2 w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase text-muted">
              <th className="py-2 pr-3 font-medium">Registration number</th>
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">Attended</th>
              <th className="py-2 pr-3 font-medium">Held</th>
              <th className="py-2 pr-3 font-medium">Percentage</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.regNumber} className="border-b border-line">
                <td className="py-2 pr-3 text-ink">{row.regNumber}</td>
                <td className="py-2 pr-3 text-ink">{row.studentName ?? '—'}</td>
                <td className="py-2 pr-3 text-ink">{row.attended}</td>
                <td className="py-2 pr-3 text-ink">{row.held}</td>
                <td className="py-2 pr-3 text-ink">{formatPercentage(row.percentage)}</td>
                <td className="py-2 text-ink">{bandLabel(row.band)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <SignatureArea />
    </div>
  );
}

function AtRiskPrint({ report }: { report: AtRiskReportData }) {
  const { course } = report;
  const below = report.rows.filter((row) => row.band === 'below').length;
  const approaching = report.rows.length - below;
  return (
    <div>
      <h2 className="mt-6 text-[20px] font-semibold text-ink">
        {course.code} — {course.title}
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        Students at risk · {course.departmentName} · {course.semesterName} ·{' '}
        {course.academicSessionName}
      </p>

      <table className="mt-6 w-full text-left text-[13px]">
        <tbody>
          <MetaRow label="Department" value={course.departmentName} />
          <MetaRow label="Course" value={`${course.code} — ${course.title}`} />
          <MetaRow label="Academic session" value={course.academicSessionName} />
          <MetaRow label="Semester" value={course.semesterName} />
          <MetaRow label="Lecturer" value={course.lecturerName} />
          <MetaRow label="Attendance bar" value={`${course.threshold}%`} />
          <MetaRow
            label="Sessions held"
            value={`${report.heldSessions} of ${report.totalSessions} finished`}
          />
          <MetaRow
            label="On this list"
            value={`${below} below the bar · ${approaching} close to the bar`}
          />
        </tbody>
      </table>

      <p className="mt-6 text-[13px] text-ink">
        This list shows students below the bar and close to it, as of the date above, counted
        from sessions actually held. Only finished sessions (Finalized or Archived) count as
        held. The exact percentage decides — 74.6% is below a 75% bar. The lecturer and the
        head of department decide who writes the exam — this list never bans anyone on its own.
      </p>

      <h3 className="mt-8 text-[14px] font-semibold text-ink">Students at risk</h3>
      {report.rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">
          Nobody is below or close to the bar in this course.
        </p>
      ) : (
        <table className="mt-2 w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase text-muted">
              <th className="py-2 pr-3 font-medium">Registration number</th>
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">Attended</th>
              <th className="py-2 pr-3 font-medium">Held</th>
              <th className="py-2 pr-3 font-medium">Percentage</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.regNumber} className="border-b border-line">
                <td className="py-2 pr-3 text-ink">{row.regNumber}</td>
                <td className="py-2 pr-3 text-ink">{row.studentName ?? '—'}</td>
                <td className="py-2 pr-3 text-ink">{row.attended}</td>
                <td className="py-2 pr-3 text-ink">{row.held}</td>
                <td className="py-2 pr-3 text-ink">{formatPercentage(row.percentage)}</td>
                <td className="py-2 text-ink">{bandLabel(row.band)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <SignatureArea />
    </div>
  );
}

/**
 * The print view itself. It opens the browser print dialog once it
 * mounts and calls `onDone` when the dialog closes (including on
 * cancel) so the caller can unmount it. On screen it renders
 * nothing visible — `.print-report` is `display: none` outside
 * print.
 */
export function PrintReport({ report, onDone }: { report: ReportData; onDone: () => void }) {
  useEffect(() => {
    const done = () => onDone();
    window.addEventListener('afterprint', done);
    // After paint, so the report is in the DOM when printing.
    const timer = window.setTimeout(() => {
      if (typeof window.print === 'function') window.print();
    }, 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', done);
    };
  }, [onDone]);

  return (
    <div className="print-report" aria-hidden="true">
      <div className="flex items-start justify-between border-b border-line pb-4">
        <span className="inline-flex items-center gap-2">
          <PrintMark />
          <span className="text-[18px] font-semibold tracking-tight text-ink">Qovu</span>
        </span>
        <span className="text-right text-[12px] text-muted">
          Attendance report
          <span className="block">Generated {formatGeneratedAt(report.generatedAt)}</span>
        </span>
      </div>

      {report.kind === 'session' ? (
        <SessionPrint report={report} />
      ) : report.kind === 'course' ? (
        <CoursePrint report={report} />
      ) : (
        <AtRiskPrint report={report} />
      )}

      <div className="print-footer" aria-hidden="true">
        <span>Qovu — Attendance report</span>
        <span className="print-page-number" />
      </div>
    </div>
  );
}
