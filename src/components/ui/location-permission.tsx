import { Button } from '@/components/ui/button';

/**
 * Explicit location-permission UI (v0.5.1).
 *
 * A website cannot force the browser to re-show its permission
 * prompt after a denial, and cannot switch on OS location services —
 * so when location is blocked for this site the app shows plain
 * steps for re-allowing it instead of calling getCurrentPosition
 * again (a denied permission never re-prompts). When the permission
 * is 'prompt' or 'granted', the request is triggered from an
 * explicit user tap so the browser shows its prompt reliably.
 */
export function LocationBlockedPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card" role="alert">
      <p className="text-[15px] font-medium text-ink">Location is blocked for this site</p>
      <p className="mt-1 text-[13px] text-muted">
        Your browser is not sharing location with Qovu, so this step cannot continue.
        The app cannot turn location back on by itself — allow it for this site, then try
        again.
      </p>
      <div className="mt-3 flex flex-col gap-2 text-[13px] text-muted">
        <p>
          <span className="font-medium text-ink">Chrome (Android / desktop): </span>
          tap the tune or lock icon in the address bar → Site settings → Location → Allow.
        </p>
        <p>
          <span className="font-medium text-ink">Safari (iPhone): </span>
          tap the aA icon in the address bar → Website Settings → Location → Allow. Also
          check Settings → Privacy &amp; Security → Location Services is on.
        </p>
      </div>
      <Button variant="secondary" className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function LocationAllowPanel({
  onAllow,
  locating,
  elapsedSeconds,
}: {
  onAllow: () => void;
  locating: boolean;
  /** Seconds spent waiting for a GPS fix so far (v0.10.1): shown
   *  while the patient capture runs, so the wait never looks stuck. */
  elapsedSeconds?: number;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[15px] font-medium text-ink">Allow location to continue</p>
      <p className="mt-1 text-[13px] text-muted">
        Qovu needs your location for this step. Tap the button and allow location when
        your browser asks.
      </p>
      {locating && elapsedSeconds !== undefined ? (
        <p className="mt-2 text-[13px] text-muted" role="status">
          Waiting for your location… {elapsedSeconds}s — this can take a minute without
          mobile data. Stay near a window.
        </p>
      ) : null}
      <Button className="mt-3" disabled={locating} onClick={onAllow}>
        {locating ? 'Finding your location…' : 'Allow location to continue'}
      </Button>
    </div>
  );
}
