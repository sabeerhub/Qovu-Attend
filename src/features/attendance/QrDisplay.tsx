import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { buildQrPayload, buildSubmitUrl, formatCountdown, tokenRemainingSeconds } from '@/lib/qr';
import { LoadingState } from '@/components/ui/empty-state';

/**
 * QR code + classroom passcode, shown ONCE when a session is
 * activated. The QR encodes the session id + token; the token itself
 * is never stored anywhere — only its hash lives server-side. The
 * countdown is display-only: the server decides whether the token
 * is still valid.
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
  const [remaining, setRemaining] = useState(() =>
    tokenRemainingSeconds(issuedAt, expiresInSeconds),
  );

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(buildQrPayload(sessionId, token), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
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
  }, [sessionId, token]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemaining(tokenRemainingSeconds(issuedAt, expiresInSeconds));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [issuedAt, expiresInSeconds]);

  const expired = remaining <= 0;
  const submitUrl =
    typeof window !== 'undefined'
      ? buildSubmitUrl(window.location.origin, sessionId, token)
      : '';

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
      <h3 className="text-[17px] font-semibold text-ink">Attendance is open</h3>
      <p className="mt-1 text-[13px] text-muted">
        Students scan this code or use the passcode. This code is shown once — if you leave
        this screen, close and reopen the session to issue a new one.
      </p>

      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="QR code for attendance submission"
          width={220}
          height={220}
          className="mt-4 border border-line bg-surface p-2"
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
