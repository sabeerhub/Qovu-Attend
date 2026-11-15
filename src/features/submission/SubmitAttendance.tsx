import { useState, type FormEvent } from 'react';
import { buildIdempotencyKey, isValidRegistrationNumber, normalizeRegistrationNumber } from '@/lib/submission';
import { getSubmitParams, submitAttendance } from '@/lib/edgeFunctions';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';

/**
 * Public attendance submission — no student account, no sign-in.
 * Reached at `?submit=<sessionId>&token=<token>` (the link the QR
 * code encodes). Without a token in the URL, the student enters the
 * classroom passcode instead.
 *
 * It asks only for a registration number. It shows no session details
 * and no other session's data: the session is identified server-side
 * from the token/passcode, and the server decides success, duplicate,
 * expiry or error. When no backend is configured, the honest
 * unavailable state is shown — never a fake confirmation.
 */
export function SubmitAttendance() {
  const params = typeof window !== 'undefined' ? getSubmitParams(window.location.search) : null;
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [passcode, setPasscode] = useState('');
  const [state, setState] = useState<
    | { status: 'form' }
    | { status: 'submitting' }
    | { status: 'success'; registrationNumber: string; duplicate: boolean; retried: boolean }
    | { status: 'error'; code: string; message: string }
  >({ status: 'form' });
  const [formError, setFormError] = useState<string | null>(null);

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

  if (!params) {
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
    const token = params?.token ?? null;
    const trimmedPasscode = passcode.trim();
    if (!token && trimmedPasscode.length === 0) {
      setFormError('Enter the classroom passcode shown by your lecturer.');
      return;
    }
    if (!params) return;
    const normalized = normalizeRegistrationNumber(registrationNumber);
    setState({ status: 'submitting' });
    const result = await submitAttendance({
      sessionId: params.sessionId,
      registrationNumber: normalized,
      token: token ?? undefined,
      passcode: token ? undefined : trimmedPasscode,
      idempotencyKey: buildIdempotencyKey(params.sessionId, normalized),
    });
    if (!result.ok) {
      setState({ status: 'error', code: result.error.code, message: result.error.message });
      return;
    }
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
          <LoadingState label="Submitting your attendance…" />
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
                      : state.message
            }
            onRetry={() => setState({ status: 'form' })}
          />
        </div>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 flex flex-col gap-4">
          <p className="text-[13px] text-muted">
            Enter your registration number to record attendance for this session. No account is
            needed.
          </p>
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
          {!params.token ? (
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
          <Button type="submit" className="self-start">
            Submit attendance
          </Button>
        </form>
      )}
    </div>
  );
}
