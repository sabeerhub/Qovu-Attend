import { useState, type FormEvent } from 'react';
import { isValidPasscode } from '@/lib/qr';
import { isSupabaseConfigured } from '@/lib/supabase';
import { SubmitAttendance } from './SubmitAttendance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Passcode entry page — `/submit` with no session in the URL
 * (v0.5.4). For the student whose phone cannot scan the QR code:
 * type the 6-digit code the lecturer is showing, then the
 * attendance form appears (registration number, then the same
 * location + device checks as the QR path).
 *
 * The code is checked for format here only. It is verified
 * server-side at submission — the server resolves the session from
 * the passcode hash, exactly as the existing passcode path does when
 * the session is already known from the URL. A wrong code is
 * therefore reported by the form as "not valid for this session".
 */
export function SubmitEntry() {
  const [passcode, setPasscode] = useState('');
  const [resolvedPasscode, setResolvedPasscode] = useState<string | null>(null);
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

  if (resolvedPasscode) {
    return (
      <div>
        <div className="mx-auto w-full max-w-md px-4 pt-10">
          <button
            type="button"
            onClick={() => {
              setResolvedPasscode(null);
              setPasscode('');
            }}
            className="text-[13px] text-accent underline-offset-2 hover:underline"
          >
            Use a different code
          </button>
        </div>
        <SubmitAttendance passcode={resolvedPasscode} />
      </div>
    );
  }

  function onContinue(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!isValidPasscode(passcode)) {
      setFormError('Enter the 6-digit code your lecturer is showing.');
      return;
    }
    setResolvedPasscode(passcode.trim());
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">UniAttend</h1>
      <p className="mt-1 text-[13px] text-muted">Attendance submission</p>

      <form onSubmit={onContinue} className="mt-6 flex flex-col gap-4">
        <p className="text-[13px] text-muted">
          Enter the code your lecturer is showing. No account is needed,
          and no camera is needed — the code works instead of the QR code.
        </p>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
          Classroom passcode
          <Input
            required
            inputMode="numeric"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="6-digit passcode"
            autoComplete="off"
            autoFocus
          />
        </label>
        {formError ? (
          <p className="text-[13px] text-danger" role="alert">
            {formError}
          </p>
        ) : null}
        <Button type="submit" className="self-start">
          Continue
        </Button>
      </form>
    </div>
  );
}
