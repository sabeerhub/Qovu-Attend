import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { buildQrPayload, formatCountdown, tokenRemainingSeconds } from '@/lib/qr';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/empty-state';

/**
 * QR code + classroom passcode, shown ONCE when a session is
 * activated. The QR encodes the public submission URL, so a phone
 * camera opens the attendance page when it scans it; the token
 * itself is never stored anywhere — only its hash lives server-side. The
 * countdown is display-only: the server decides whether the token
 * is still valid.
 *
 * Projector view (Phase 4): the lecturer projects the QR for the
 * hall, so the code is rendered large and can be shown fullscreen
 * with minimal chrome — big QR, big passcode, nothing else.
 */
export function QrDisplay({
  sessionId,
  token,
  passcode,
  issuedAt,
  expiresInSeconds,
}: {
  sessionId: string;
  token: string;
  passcode: string;
  issuedAt: string;
  expiresInSeconds: number;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [projector, setProjector] = useState(false);
  const [remaining, setRemaining] = useState(() =>
    tokenRemainingSeconds(issuedAt, expiresInSeconds),
  );

  // One URL, built once: the QR image and the displayed submission
  // link below both use this exact string, so they can never disagree.
  const submitUrl =
    typeof window !== 'undefined'
      ? buildQrPayload(window.location.origin, sessionId, token)
      : '';

  useEffect(() => {
    let cancelled = false;
    // Rendered large so it stays crisp when projected fullscreen.
    QRCode.toDataURL(submitUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 560,
      color: { dark: '#111111', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setQrError('The QR code could not be rendered. The passcode below still works.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [submitUrl]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemaining(tokenRemainingSeconds(issuedAt, expiresInSeconds));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [issuedAt, expiresInSeconds]);

  const expired = remaining <= 0;

  // Projector mode closes on Escape.
  useEffect(() => {
    if (!projector) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProjector(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [projector]);

  if (projector) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        <Button
          variant="secondary"
          onClick={() => setProjector(false)}
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]"
        >
          Close (Esc)
        </Button>
        <h3 className="text-[28px] font-semibold tracking-tight text-ink">Attendance is open</h3>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR code for attendance submission"
            width={480}
            height={480}
            className="h-auto w-full max-w-[480px] border border-line bg-white p-3"
          />
        ) : (
          <LoadingState label="Generating QR code…" />
        )}
        <p className="text-center text-[17px] text-muted">
          No camera? Use the passcode
        </p>
        <p className="text-[56px] font-semibold leading-none tracking-[0.2em] text-ink">{passcode}</p>
        <p className="text-[15px] text-muted">
          {expired ? 'Expired — the server will reject new submissions.' : `Expires in ${formatCountdown(remaining)}`}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[17px] font-semibold text-ink">Attendance is open</h3>
          <p className="mt-1 text-[13px] text-muted">
            Students scan this code or use the passcode. This code is shown once — if you leave
            this screen, close and reopen the session to issue a new one.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setProjector(true)} disabled={!qrDataUrl}>
          Project fullscreen
        </Button>
      </div>

      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="QR code for attendance submission"
          width={280}
          height={280}
          className="mx-auto mt-4 h-auto w-[260px] border border-line bg-surface p-2 sm:w-[220px]"
        />
      ) : qrError ? (
        <p className="mt-4 text-[13px] text-danger" role="alert">
          {qrError}
        </p>
      ) : (
        <LoadingState label="Generating QR code…" />
      )}

      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <div className="flex items-baseline gap-3">
          <dt className="w-28 text-[13px] text-muted">Classroom passcode</dt>
          <dd className="text-[17px] font-semibold tracking-[0.2em] text-ink">{passcode}</dd>
        </div>
        <div className="flex items-baseline gap-3">
          <dt className="w-28 text-[13px] text-muted">Expires in</dt>
          <dd className="text-[15px] text-ink">
            {expired ? 'Expired — the server will reject new submissions.' : formatCountdown(remaining)}
          </dd>
        </div>
        <div className="flex items-baseline gap-3">
          <dt className="w-28 text-[13px] text-muted">Submission link</dt>
          <dd className="break-all text-[13px] text-muted">{submitUrl}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[13px] text-muted">
        Expiry is checked by the server. The countdown above is only a display.
      </p>
    </div>
  );
}
