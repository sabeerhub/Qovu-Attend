import { useState, type FormEvent } from 'react';
import { buildIdempotencyKey, isValidRegistrationNumber, newIdempotencyKey, normalizeRegistrationNumber } from '@/lib/submission';
import { getSubmitParams, submitAttendance } from '@/lib/edgeFunctions';
import { locationErrorMessage, nextLocationStep, queryLocationPermission, requestDeviceLocation } from '@/lib/geo';
import { LocationAllowPanel, LocationBlockedPanel } from '@/components/ui/location-permission';
import {
  getDeviceFingerprint,
  readSubmittedFlag,
  writeSubmittedFlag,
} from '@/lib/deviceFingerprint';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';

/**
 * Public attendance submission — no student account, no sign-in.
 * Reached at `?submit=<sessionId>&token=<token>` (the link the QR
 * code encodes) or from the /submit entry page with the classroom
 * passcode already entered (v0.5.4). Without a token in the URL, the
 * student enters the classroom passcode instead.
 *
 * It asks only for a registration number. It shows no session details
 * and no other session's data: the session is identified server-side
 * from the token/passcode, and the server decides success, duplicate,
 * expiry or error. When no backend is configured, the honest
 * unavailable state is shown — never a fake confirmation.
 *
 * Phase 4 (v0.5.0): location is mandatory — a submission without
 * the student's device coordinates is refused, and the server
 * rejects it when the student is outside the lecturer's 30 m radius
 * or the position is too imprecise. The device fingerprint (SHA-256
 * hash only) binds one device to one registration number,
 * server-side. Both checks apply identically to the QR-token path
 * and the passcode path.
 */
export function SubmitAttendance(props?: { passcode?: string }) {
  const urlParams = typeof window !== 'undefined' ? getSubmitParams(window.location.search) : null;
  // Passcode-only (v0.5.4): the student came from the /submit entry
  // page with the code already entered. There is no session id yet —
  // the server resolves the session from the passcode hash.
  const passcodeOnly = typeof props?.passcode === 'string' && props.passcode.length > 0;
  const sessionId = urlParams?.sessionId ?? null;
  const token = urlParams?.token ?? null;
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [passcode, setPasscode] = useState(props?.passcode ?? '');
  const [state, setState] = useState<
    | { status: 'form' }
    | { status: 'submitting' }
    | { status: 'success'; registrationNumber: string; duplicate: boolean; retried: boolean }
    | { status: 'error'; code: string; message: string }
  >({ status: 'form' });
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  // Location permission gate (v0.5.1): the browser is asked to
  // share location from an explicit tap, and a denial shows
  // re-allow steps instead of calling getCurrentPosition again.
  const [locationGate, setLocationGate] = useState<null | {
    permission: 'granted' | 'prompt' | 'denied' | 'unknown';
  }>(null);
  // Per-browser hint only (localStorage): this browser already
  // submitted for a registration number in this session. The server
  // enforces device binding; this is just a heads-up, never a block.
  // Unavailable in the passcode-only flow — there is no session id
  // until the server resolves one.
  const browserFlag = sessionId ? readSubmittedFlag(sessionId) : null;

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">UniAttend</h1>
        <p className="mt-1 text-[13px] text-muted">Attendance submission</p>
        <div className="mt-6">
          <EmptyState
            title="Attendance submission is unavailable"
            description="The attendance service is not configured yet. Ask your lecturer — submissions will work once the university's Supabase project is connected."
          />
        </div>
      </div>
    );
  }

  if (!urlParams && !passcodeOnly) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">UniAttend</h1>
        <p className="mt-1 text-[13px] text-muted">Attendance submission</p>
        <div className="mt-6">
          <EmptyState
            title="No session selected"
            description="Open the submission link from your lecturer's QR code to submit attendance for a session."
          />
        </div>
      </div>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!isValidRegistrationNumber(registrationNumber)) {
      setFormError('Enter your registration number.');
      return;
    }
    const trimmedPasscode = passcode.trim();
    if (!token && trimmedPasscode.length === 0) {
      setFormError('Enter the classroom passcode shown by your lecturer.');
      return;
    }
    if (!urlParams && !passcodeOnly) return;
    await startLocationFlow();
  }

  async function startLocationFlow() {
    // Explicit permission step (v0.5.1): check the permission state
    // first. A denial never re-prompts, so it shows re-allow steps;
    // prompt/granted need an explicit tap so the browser shows its
    // prompt reliably; without a Permissions API, go straight to
    // the capture.
    const permission = await queryLocationPermission();
    const step = nextLocationStep(permission);
    if (step === 'blocked') {
      setLocationGate({ permission });
      return;
    }
    if (step === 'request') {
      await submitWithLocation();
      return;
    }
    setLocationGate({ permission });
  }

  async function submitWithLocation() {
    if (!urlParams && !passcodeOnly) return;
    // Re-check the inputs: the Allow tap happens after validation,
    // but the values may have changed since.
    if (!isValidRegistrationNumber(registrationNumber)) {
      setLocationGate(null);
      setFormError('Enter your registration number.');
      return;
    }
    const trimmedPasscode = passcode.trim();
    if (!token && trimmedPasscode.length === 0) {
      setLocationGate(null);
      setFormError('Enter the classroom passcode shown by your lecturer.');
      return;
    }
    const normalized = normalizeRegistrationNumber(registrationNumber);
    setLocationGate(null);
    setState({ status: 'submitting' });
    // Location is mandatory: no coordinates, no attendance. The
    // student must allow location for this site.
    setProgress('Checking your location…');
    const location = await requestDeviceLocation();
    if (!location.ok || !location.coords) {
      setProgress(null);
      setState({
        status: 'error',
        code: 'location_required',
        message: locationErrorMessage(location.error ?? 'unavailable'),
      });
      return;
    }
    // Device fingerprint (hash only). Without it the server cannot
    // enforce one device per student, so the submission is refused.
    setProgress('Verifying this device…');
    const deviceFingerprint = await getDeviceFingerprint();
    if (!deviceFingerprint) {
      setProgress(null);
      setState({
        status: 'error',
        code: 'device_unavailable',
        message:
          'This device could not be verified. Use a phone and browser that support location and device checks.',
      });
      return;
    }
    setProgress('Submitting your attendance…');
    const result = await submitAttendance({
      // Passcode-only (v0.5.4): no session id — the server resolves
      // the session from the passcode hash. The key is omitted from
      // the JSON body when undefined.
      sessionId: sessionId ?? undefined,
      registrationNumber: normalized,
      token: token ?? undefined,
      passcode: token ? undefined : trimmedPasscode,
      // Without a session id the stable per-(session, student) key
      // cannot be built; use an attempt-scoped key instead. A retry
      // is still deduplicated server-side by the unique constraint
      // on (session_id, registration_number).
      idempotencyKey: sessionId
        ? buildIdempotencyKey(sessionId, normalized)
        : newIdempotencyKey(),
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      deviceFingerprint,
    });
    setProgress(null);
    if (!result.ok) {
      setState({ status: 'error', code: result.error.code, message: result.error.message });
      return;
    }
    if (sessionId) writeSubmittedFlag(sessionId, normalized);
    setState({
      status: 'success',
      registrationNumber: normalized,
      duplicate: result.data.duplicate,
      retried: result.data.retried,
    });
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">UniAttend</h1>
      <p className="mt-1 text-[13px] text-muted">Attendance submission</p>

      {state.status === 'submitting' ? (
        <div className="mt-6">
          <LoadingState label={progress ?? 'Submitting your attendance…'} />
        </div>
      ) : state.status === 'success' ? (
        <div className="mt-6 rounded-xl border border-line bg-surface px-6 py-10">
          <p className="text-[15px] font-medium text-ink">
            {state.duplicate
              ? state.retried
                ? 'Attendance already recorded'
                : 'You have already submitted attendance for this session.'
              : 'Attendance recorded'}
          </p>
          <p className="mt-2 text-[13px] text-muted">
            Registration number {state.registrationNumber} is recorded for this session.
            {state.duplicate ? ' No second record was created.' : ' Keep this page as your confirmation.'}
          </p>
        </div>
      ) : state.status === 'error' ? (
        <div className="mt-6">
          <ErrorState
            message={
              state.code === 'token_expired'
                ? 'The QR code for this session has expired. Ask your lecturer for a new code.'
                : state.code === 'session_not_active'
                  ? 'This session is not collecting attendance right now.'
                  : state.code === 'invalid_token'
                    ? 'The QR code or passcode is not valid for this session. Check it and try again.'
                    : state.code === 'rate_limited'
                      ? 'Too many submissions right now. Wait a minute and try again.'
                      : state.code === 'location_required'
                        ? 'Location is required to mark attendance. Turn on location services, allow location for this site, and try again.'
                        : state.code === 'location_not_configured'
                          ? 'This session was started before location checks. Ask your lecturer to close and reopen it.'
                          : state.code === 'location_too_imprecise'
                            ? 'Your location is too imprecise to verify. Move somewhere with a clearer GPS signal and try again.'
                            : state.code === 'outside_location'
                              ? 'You are too far from the lecture hall to submit attendance for this session.'
                              : state.code === 'device_bound_to_another_student'
                                ? 'This device is already registered to another student. Use the device that belongs to this registration number.'
                                : state.code === 'device_already_used'
                                  ? 'This device has already submitted attendance for this session.'
                                  : state.message
            }
            onRetry={() => setState({ status: 'form' })}
          />
        </div>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 flex flex-col gap-4">
          <p className="text-[13px] text-muted">
            Enter your registration number to record attendance for this session. No account is
            needed. Your location is required — attendance is only recorded while you are in
            the lecture hall — and one device can only submit for one student.
          </p>
          {browserFlag ? (
            <p className="rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-muted" role="status">
              This browser already submitted attendance for {browserFlag} in this session.
            </p>
          ) : null}
          {locationGate ? (
            locationGate.permission === 'denied' ? (
              <LocationBlockedPanel
                onRetry={() => {
                  setLocationGate(null);
                  void startLocationFlow();
                }}
              />
            ) : (
              <LocationAllowPanel locating={false} onAllow={() => void submitWithLocation()} />
            )
          ) : null}
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Registration number
            <Input
              required
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="FUT/2022/001"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </label>
          {!token && !passcodeOnly ? (
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
              Classroom passcode
              <Input
                required
                inputMode="numeric"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="6-digit passcode"
                autoComplete="off"
              />
            </label>
          ) : null}
          {formError ? (
            <p className="text-[13px] text-danger" role="alert">
              {formError}
            </p>
          ) : null}
          <Button type="submit" disabled={locationGate !== null} className="self-start">
            Submit attendance
          </Button>
        </form>
      )}
    </div>
  );
}
