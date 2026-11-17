import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { canTransitionSession, isFinalized } from '@/lib/attendance';
import { locationErrorMessage, nextLocationStep, queryLocationPermission, requestDeviceLocation, type GeoCoords, type LocationPermissionState } from '@/lib/geo';
import {
  canEditSessionRecords,
  headcountDifference,
  parseHeadcountInput,
  summarizeRecords,
  validateCorrection,
  validateManualAttendance,
} from '@/lib/submission';
import { correctRecord, manualAdd, reviewFace, transitionSession } from '@/lib/edgeFunctions';
import { QrDisplay } from './QrDisplay';
import { LocationAllowPanel, LocationBlockedPanel } from '@/components/ui/location-permission';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';
import type {
  AttendanceRecord,
  AttendanceRecordStatus,
  AttendanceSession,
  SessionStatus,
} from '@/types/database';

export interface ActivationResult {
  token: string;
  passcode: string;
  issuedAt: string;
  expiresInSeconds: number;
}

const LIFECYCLE_ACTIONS: Array<{ to: SessionStatus; label: string; variant: 'primary' | 'secondary' | 'danger' }> = [
  { to: 'active', label: 'Start session', variant: 'primary' },
  { to: 'closed', label: 'Close session', variant: 'secondary' },
  { to: 'finalized', label: 'Finalize', variant: 'secondary' },
  { to: 'archived', label: 'Archive', variant: 'danger' },
];

const ACTION_LABELS: Record<string, string> = {
  active: 'Start session',
  closed: 'Close session',
  finalized: 'Finalize',
  archived: 'Archive',
};

/**
 * Session monitoring (spec §8). For one Active/Closed session — and
 * read-only for Finalized/Archived ones — it shows the physical
 * headcount, verified / manual / pending / rejected / suspicious
 * counts from real record queries, the headcount-vs-submissions
 * difference (a number to review, NOT automatic evidence of fraud),
 * the submitted registration numbers with their statuses, manual
 * attendance, corrections, and the lifecycle controls.
 *
 * Phase 4 (v0.5.0): starting a session captures the lecturer's
 * device location as the anchor (refused without it) and confirms
 * the physical headcount just counted in the hall; the monitor
 * shows the anchor state and flags it for review — never as
 * automatic fraud — when verified + manual submissions exceed the
 * confirmed headcount.
 *
 * All writes go through Edge Functions; the client never writes a
 * record or an audit row directly.
 */
export function SessionMonitor({
  session: initialSession,
  courseCode,
  initialActivation,
  onBack,
  onSessionChanged,
}: {
  session: AttendanceSession;
  courseCode: string | null;
  initialActivation: ActivationResult | null;
  onBack: () => void;
  onSessionChanged: () => void;
}) {
  const [session, setSession] = useState(initialSession);
  const [activation, setActivation] = useState<ActivationResult | null>(initialActivation);
  const [headcountInput, setHeadcountInput] = useState(
    initialSession.headcount === null ? '' : String(initialSession.headcount),
  );
  const [recordsState, setRecordsState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; records: AttendanceRecord[] }
  >({ status: 'loading' });
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [acting, setActing] = useState<SessionStatus | null>(null);
  // Location permission gate (v0.5.1): activation first asks the
  // browser to share location, from an explicit tap, and shows a
  // visible "Finding your location…" state while the capture runs.
  const [locationGate, setLocationGate] = useState<null | {
    to: SessionStatus;
    permission: LocationPermissionState;
  }>(null);
  const [locating, setLocating] = useState(false);

  const [manualRegNo, setManualRegNo] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualBusy, setManualBusy] = useState(false);

  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctStatus, setCorrectStatus] = useState<AttendanceRecordStatus>('verified');
  const [correctReason, setCorrectReason] = useState('');
  const [correctError, setCorrectError] = useState<string | null>(null);
  const [correctBusy, setCorrectBusy] = useState(false);

  // Face review (v0.10.0): flagged records show the photo (a
  // short-lived signed URL, only for the assigned lecturer) and a
  // confirm/dismiss form. Photos are deleted at Finalize, so a
  // finalized session's flag has no photo left to show.
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [photoLoadingId, setPhotoLoadingId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [faceReviewId, setFaceReviewId] = useState<string | null>(null);
  const [faceReviewReason, setFaceReviewReason] = useState('');
  const [faceReviewError, setFaceReviewError] = useState<string | null>(null);
  const [faceReviewBusy, setFaceReviewBusy] = useState(false);

  const loadRecords = useCallback(async () => {
    if (!supabase) return;
    setRecordsState({ status: 'loading' });
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('id, session_id, registration_number, student_name, status, verification_method, manual_reason, idempotency_key, submitted_at, selfie_path, selfie_hash, face_review')
        .eq('session_id', session.id)
        .order('submitted_at', { ascending: true });
      if (error) setRecordsState({ status: 'error', message: error.message });
      else setRecordsState({ status: 'ready', records: (data ?? []) as AttendanceRecord[] });
    } catch (err: unknown) {
      setRecordsState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not load attendance records.',
      });
    }
  }, [session.id]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const records = recordsState.status === 'ready' ? recordsState.records : [];
  const summary = summarizeRecords(records);
  const diff = headcountDifference(session.headcount, summary.total);
  // Review flag (Phase 4): verified + manual past the confirmed
  // physical headcount. A flag to review — never automatic fraud.
  const exceedsHeadcount =
    session.headcount !== null && summary.verified + summary.manual > session.headcount;
  const editable = canEditSessionRecords(session.status);
  const readOnly = isFinalized(session.status);
  const canActivate = canTransitionSession(session.status, 'active');

  async function runTransition(to: SessionStatus) {
    setNotice(null);
    if (to !== 'active') {
      await completeTransition(to, undefined, undefined);
      return;
    }
    // Activation (Phase 4): the lecturer's location is the anchor,
    // and the headcount is confirmed from the count just taken in
    // the hall. Without a location the session does not start.
    const parsed = parseHeadcountInput(headcountInput);
    if (!parsed.ok) {
      setNotice({ kind: 'error', text: parsed.error });
      return;
    }
    const confirmedHeadcount = parsed.value ?? undefined;
    // Explicit permission step (v0.5.1): check the permission state
    // first. A denial never re-prompts, so it shows re-allow steps
    // instead of calling getCurrentPosition; prompt/granted need an
    // explicit tap so the browser shows its prompt reliably.
    const permission = await queryLocationPermission();
    const step = nextLocationStep(permission);
    if (step === 'blocked') {
      setLocationGate({ to, permission });
      return;
    }
    setLocationGate({ to, permission });
    if (step === 'request') {
      // No Permissions API: go straight to the capture, visibly.
      await locateAndActivate(to, confirmedHeadcount);
    }
  }

  async function locateAndActivate(to: SessionStatus, confirmedHeadcount: number | undefined) {
    setLocating(true);
    const location = await requestDeviceLocation();
    setLocating(false);
    setLocationGate(null);
    if (!location.ok || !location.coords) {
      setNotice({
        kind: 'error',
        text: `Your location is required to start a session. ${locationErrorMessage(location.error ?? 'unavailable')}`,
      });
      return;
    }
    await completeTransition(to, location.coords, confirmedHeadcount);
  }

  async function completeTransition(
    to: SessionStatus,
    anchor: GeoCoords | undefined,
    confirmedHeadcount: number | undefined,
  ) {
    setActing(to);
    const result = await transitionSession(session.id, to, { anchor, headcount: confirmedHeadcount });
    setActing(null);
    if (!result.ok) {
      setNotice({ kind: 'error', text: result.error.message });
      return;
    }
    const label = to === 'active' && session.status === 'closed' ? 'Reopened session' : ACTION_LABELS[to] ?? 'Session updated';
    setNotice({
      kind: 'success',
      text: result.data.warning ?? `${label} — now ${result.data.session.status}.`,
    });
    setSession((s) => ({
      ...s,
      status: result.data.session.status,
      headcount: result.data.session.headcount,
      anchor_latitude: result.data.session.anchor_latitude,
      anchor_longitude: result.data.session.anchor_longitude,
      anchor_accuracy_meters: result.data.session.anchor_accuracy_meters,
      anchor_captured_at: result.data.session.anchor_captured_at,
      location_radius_meters: result.data.session.location_radius_meters,
    }));
    if (result.data.session.headcount !== null) {
      setHeadcountInput(String(result.data.session.headcount));
    }
    if (result.data.token && result.data.passcode && result.data.session.qr_token_issued_at) {
      setActivation({
        token: result.data.token,
        passcode: result.data.passcode,
        issuedAt: result.data.session.qr_token_issued_at,
        expiresInSeconds: result.data.session.qr_expires_in_seconds,
      });
    } else if (to !== 'active') {
      setActivation(null);
    }
    onSessionChanged();
  }

  async function onManualSubmit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateManualAttendance({ registrationNumber: manualRegNo, reason: manualReason });
    if (validationError) {
      setManualError(validationError);
      return;
    }
    setManualError(null);
    setManualBusy(true);
    const result = await manualAdd(session.id, manualRegNo, manualReason);
    setManualBusy(false);
    if (!result.ok) {
      setManualError(result.error.message);
      return;
    }
    setManualRegNo('');
    setManualReason('');
    setNotice({
      kind: 'success',
      text: result.data.warning ?? 'Manual attendance added and recorded in the audit log.',
    });
    void loadRecords();
  }

  async function onCorrectSubmit(event: FormEvent, record: AttendanceRecord) {
    event.preventDefault();
    const validationError = validateCorrection({ newStatus: correctStatus, reason: correctReason });
    if (validationError) {
      setCorrectError(validationError);
      return;
    }
    setCorrectError(null);
    setCorrectBusy(true);
    const result = await correctRecord(session.id, record.id, correctStatus, correctReason);
    setCorrectBusy(false);
    if (!result.ok) {
      setCorrectError(result.error.message);
      return;
    }
    setCorrectingId(null);
    setCorrectReason('');
    setNotice({
      kind: 'success',
      text: result.data.warning ?? `Record corrected to ${correctStatus} and recorded in the audit log.`,
    });
    void loadRecords();
  }

  async function loadPhoto(record: AttendanceRecord) {
    if (!supabase || !record.selfie_path) return;
    if (photoUrls[record.id]) return;
    setPhotoLoadingId(record.id);
    setPhotoError(null);
    const { data, error } = await supabase.storage
      .from('session-selfies')
      .createSignedUrl(record.selfie_path, 60);
    setPhotoLoadingId(null);
    if (error || !data?.signedUrl) {
      setPhotoError('Could not load the photo. Try again.');
      return;
    }
    setPhotoUrls((urls) => ({ ...urls, [record.id]: data.signedUrl }));
  }

  async function onFaceReview(record: AttendanceRecord, decision: 'confirm' | 'dismiss') {
    if (faceReviewReason.trim().length === 0) {
      setFaceReviewError('Enter a reason for the review. Every review is recorded in the audit log.');
      return;
    }
    setFaceReviewError(null);
    setFaceReviewBusy(true);
    const result = await reviewFace(session.id, record.id, decision, faceReviewReason.trim());
    setFaceReviewBusy(false);
    if (!result.ok) {
      setFaceReviewError(result.error.message);
      return;
    }
    setFaceReviewId(null);
    setFaceReviewReason('');
    setNotice({
      kind: 'success',
      text:
        result.data.warning ??
        (decision === 'confirm'
          ? 'Face review confirmed — the record is now suspicious and recorded in the audit log.'
          : 'Face review dismissed — the flag is cleared and recorded in the audit log.'),
    });
    void loadRecords();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" onClick={onBack} className="px-0">
            ← All sessions
          </Button>
          <h2 className="mt-1 text-[17px] font-semibold text-ink">{session.title}</h2>
          <p className="text-[13px] text-muted">
            {courseCode ?? '—'} · Week {session.week_number} · {session.lecture_date}
          </p>
        </div>
        <StatusBadge status={session.status} />
      </div>

      {notice ? (
        <p className={notice.kind === 'success' ? 'text-[13px] text-success' : 'text-[13px] text-danger'} role="status">
          {notice.text}
        </p>
      ) : null}

      {activation && session.status === 'active' ? (
        <QrDisplay
          sessionId={session.id}
          token={activation.token}
          passcode={activation.passcode}
          issuedAt={activation.issuedAt}
          expiresInSeconds={activation.expiresInSeconds}
        />
      ) : session.status === 'active' ? (
        <EmptyState
          title="QR code was shown once at activation"
          description="The QR code and passcode are shown only when the session is activated. Close and reopen the session to issue a new code."
        />
      ) : null}

      {session.status === 'active' ? (
        session.anchor_latitude !== null && session.anchor_longitude !== null ? (
          <p
            className="rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-muted shadow-card"
            role="status"
          >
            Location locked — anchor captured{' '}
            {session.anchor_captured_at
              ? new Date(session.anchor_captured_at).toLocaleString()
              : 'at activation'}
            {session.anchor_accuracy_meters !== null
              ? ` · accuracy ±${Math.round(session.anchor_accuracy_meters)} m`
              : ''}
            {` · students must be within ${session.location_radius_meters} m of your position.`}
          </p>
        ) : (
          <p
            className="rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-danger shadow-card"
            role="alert"
          >
            This session was started before location checks — student submissions will be refused
            until it is closed and reopened.
          </p>
        )
      ) : null}

      <section>
        <h3 className="mb-4 text-[17px] font-semibold text-ink">Monitoring</h3>
        {recordsState.status === 'loading' ? (
          <LoadingState label="Loading attendance records…" />
        ) : recordsState.status === 'error' ? (
          <ErrorState message={recordsState.message} onRetry={() => void loadRecords()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {(
                [
                  ['Physical headcount', session.headcount === null ? '—' : String(session.headcount)],
                  ['Verified', String(summary.verified)],
                  ['Manual', String(summary.manual)],
                  ['Pending', String(summary.pending)],
                  ['Rejected', String(summary.rejected)],
                  ['Suspicious', String(summary.suspicious)],
                  ['Total submissions', String(summary.total)],
                  ['Difference to review', diff.difference === null ? '—' : String(diff.difference)],
                ] as Array<[string, string]>
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-line bg-surface p-4 shadow-card">
                  <p className="text-[13px] text-muted">{label}</p>
                  <p className="mt-1 text-[28px] font-semibold leading-none text-ink">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[13px] text-muted">
              {diff.difference === null
                ? 'No physical headcount was recorded for this session, so no difference can be shown.'
                : `Headcount ${session.headcount} minus ${summary.total} submissions is ${diff.difference}. A difference is a number to review — it is not automatic evidence of fraud.`}
            </p>
            {exceedsHeadcount ? (
              <p
                className="mt-3 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink"
                role="status"
              >
                <span className="font-medium">
                  Submissions exceed the physical headcount — review.
                </span>{' '}
                Verified + manual ({summary.verified + summary.manual}) is more than the
                headcount of {session.headcount}. This is a flag to review, not automatic
                evidence of fraud.
              </p>
            ) : null}
            {records.filter((r) => r.face_review).length > 0 ? (
              <p
                className="mt-3 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink"
                role="status"
              >
                <span className="font-medium">
                  {records.filter((r) => r.face_review).length} record
                  {records.filter((r) => r.face_review).length === 1 ? '' : 's'} flagged for
                  face review.
                </span>{' '}
                The same face was used for another number in this class. Check the flagged
                records in the list below — a flag is a review, not proof of cheating.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold text-ink">Submitted registration numbers</h3>
          <Button variant="secondary" onClick={() => void loadRecords()}>
            Refresh
          </Button>
        </div>
        {recordsState.status === 'loading' ? (
          <LoadingState label="Loading attendance records…" />
        ) : recordsState.status === 'error' ? (
          <ErrorState message={recordsState.message} onRetry={() => void loadRecords()} />
        ) : records.length === 0 ? (
          <EmptyState
            title="No submissions yet"
            description={
              session.status === 'active'
                ? 'No student has submitted attendance for this session yet.'
                : 'This session has no attendance records.'
            }
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[12px] uppercase text-muted">
                <th className="py-2 pr-4 font-medium">Registration number</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Method</th>
                <th className="py-2 pr-4 font-medium">Submitted</th>
                <th className="py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-line align-top last:border-b-0">
                  <td className="py-3 pr-4 text-ink">
                    {record.registration_number}
                    {record.face_review ? (
                      <span className="mt-2 block max-w-xs rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink">
                        <span className="font-medium">
                          Same face used for another number in this class — check it.
                        </span>{' '}
                        This is a flag to review, not proof of cheating: similar faces
                        can be flagged by mistake.
                        {record.selfie_path ? (
                          photoUrls[record.id] ? (
                            <img
                              src={photoUrls[record.id]}
                              alt={`Selfie for ${record.registration_number}`}
                              className="mt-2 w-40 rounded-lg"
                            />
                          ) : (
                            <span className="mt-2 block">
                              <Button
                                variant="secondary"
                                disabled={photoLoadingId === record.id}
                                onClick={() => void loadPhoto(record)}
                              >
                                {photoLoadingId === record.id ? 'Loading photo…' : 'View photo'}
                              </Button>
                              {photoError ? (
                                <span className="mt-1 block text-danger">{photoError}</span>
                              ) : null}
                            </span>
                          )
                        ) : (
                          <span className="mt-1 block text-muted">
                            The photo was deleted when the session was finalized.
                          </span>
                        )}
                        {editable ? (
                          faceReviewId === record.id ? (
                            <span className="mt-3 block">
                              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
                                Reason (required)
                                <Input
                                  value={faceReviewReason}
                                  onChange={(e) => setFaceReviewReason(e.target.value)}
                                  placeholder="What did you check?"
                                />
                              </label>
                              {faceReviewError ? (
                                <span className="mt-1 block text-danger" role="alert">
                                  {faceReviewError}
                                </span>
                              ) : null}
                              <span className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  disabled={faceReviewBusy}
                                  onClick={() => void onFaceReview(record, 'confirm')}
                                >
                                  {faceReviewBusy ? 'Saving…' : 'Confirm — same face'}
                                </Button>
                                <Button
                                  variant="secondary"
                                  disabled={faceReviewBusy}
                                  onClick={() => void onFaceReview(record, 'dismiss')}
                                >
                                  Dismiss — checked, fine
                                </Button>
                              </span>
                            </span>
                          ) : (
                            <span className="mt-2 block">
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setFaceReviewId(record.id);
                                  setFaceReviewReason('');
                                  setFaceReviewError(null);
                                }}
                              >
                                Review this flag
                              </Button>
                            </span>
                          )
                        ) : null}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={record.status} />
                    {record.manual_reason ? (
                      <span className="block text-[13px] text-muted">{record.manual_reason}</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4 text-muted">{record.verification_method ?? '—'}</td>
                  <td className="py-3 pr-4 text-muted">
                    {new Date(record.submitted_at).toLocaleString()}
                  </td>
                  <td className="py-3 text-right">
                    {editable ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setCorrectingId(correctingId === record.id ? null : record.id);
                          setCorrectStatus(record.status);
                          setCorrectReason('');
                          setCorrectError(null);
                        }}
                      >
                        {correctingId === record.id ? 'Cancel' : 'Correct'}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {correctingId && editable
          ? (() => {
              const record = records.find((r) => r.id === correctingId);
              if (!record) return null;
              return (
                <form
                  onSubmit={(e) => void onCorrectSubmit(e, record)}
                  className="mt-4 flex max-w-md flex-col gap-4 rounded-xl border border-line bg-surface p-4"
                >
                  <h4 className="text-[15px] font-medium text-ink">
                    Correct {record.registration_number}
                  </h4>
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
                    New status
                    <select
                      className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
                      value={correctStatus}
                      onChange={(e) => setCorrectStatus(e.target.value as AttendanceRecordStatus)}
                    >
                      {(['verified', 'manual', 'pending', 'rejected', 'suspicious'] as const).map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
                    Reason (required)
                    <Input
                      value={correctReason}
                      onChange={(e) => setCorrectReason(e.target.value)}
                      placeholder="Why is this record being corrected?"
                    />
                  </label>
                  {correctError ? (
                    <p className="text-[13px] text-danger" role="alert">
                      {correctError}
                    </p>
                  ) : null}
                  <Button type="submit" disabled={correctBusy} className="self-start">
                    {correctBusy ? 'Saving…' : 'Save correction'}
                  </Button>
                </form>
              );
            })()
          : null}
      </section>

      {editable ? (
        <section>
          <h3 className="mb-4 text-[17px] font-semibold text-ink">Manual attendance</h3>
          <form onSubmit={(e) => void onManualSubmit(e)} className="flex max-w-md flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
              Registration number
              <Input
                value={manualRegNo}
                onChange={(e) => setManualRegNo(e.target.value)}
                placeholder="FUT/2022/001"
                autoCapitalize="characters"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
              Reason (required)
              <Input
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder="Student arrived without a phone"
              />
            </label>
            {manualError ? (
              <p className="text-[13px] text-danger" role="alert">
                {manualError}
              </p>
            ) : null}
            <Button type="submit" disabled={manualBusy} className="self-start">
              {manualBusy ? 'Adding…' : 'Add manually'}
            </Button>
          </form>
        </section>
      ) : null}

      <section>
        <h3 className="mb-4 text-[17px] font-semibold text-ink">Session lifecycle</h3>
        {readOnly ? (
          <p className="text-[13px] text-muted">
            This session is {session.status} and read-only. Manual attendance and corrections are
            not available for finalized sessions.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {canActivate ? (
              <label className="flex max-w-md flex-col gap-1.5 text-[13px] font-medium text-ink">
                Physical headcount — confirm now
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={headcountInput}
                  onChange={(e) => setHeadcountInput(e.target.value)}
                  placeholder="Count the students in the hall"
                />
                <span className="text-[13px] font-normal text-muted">
                  Count the students in the hall now, before you project the QR code.
                  Submissions are checked against this number.
                </span>
              </label>
            ) : null}
            {locationGate ? (
              locationGate.permission === 'denied' ? (
                <LocationBlockedPanel
                  onRetry={() => {
                    setLocationGate(null);
                    void runTransition(locationGate.to);
                  }}
                />
              ) : (
                <LocationAllowPanel
                  locating={locating}
                  onAllow={() => {
                    const parsed = parseHeadcountInput(headcountInput);
                    if (!parsed.ok) {
                      setLocationGate(null);
                      setNotice({ kind: 'error', text: parsed.error });
                      return;
                    }
                    void locateAndActivate(locationGate.to, parsed.value ?? undefined);
                  }}
                />
              )
            ) : null}
            <div className="flex flex-wrap gap-3">
              {LIFECYCLE_ACTIONS.filter((a) => canTransitionSession(session.status, a.to)).map(
                (action) => {
                  // Reopen (closed → active) is labelled differently from Start (draft → active).
                  const label =
                    action.to === 'active' && session.status === 'closed'
                      ? 'Reopen session'
                      : action.label;
                  return (
                    <Button
                      key={action.to}
                      variant={action.variant}
                      disabled={acting !== null || locationGate !== null}
                      onClick={() => void runTransition(action.to)}
                    >
                      {acting === action.to ? 'Working…' : label}
                    </Button>
                  );
                },
              )}
              {LIFECYCLE_ACTIONS.filter((a) => canTransitionSession(session.status, a.to)).length === 0 ? (
                <p className="text-[13px] text-muted">No further transitions are available for this session.</p>
              ) : null}
            </div>
          </div>
        )}
        {session.status === 'finalized' && canTransitionSession(session.status, 'archived') ? (
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="danger" disabled={acting !== null || locationGate !== null} onClick={() => void runTransition('archived')}>
              {acting === 'archived' ? 'Working…' : 'Archive'}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
