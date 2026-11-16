import { useCallback, useEffect, useRef } from 'react';
import { isSplashSkipKey, splashDurationMs } from '@/lib/splash';

/**
 * Logo splash (v0.8.1): the first thing a visitor sees when they
 * open a Qovu link. Full-screen canvas white, the Q mark draws
 * itself in (ring, then tail, then the accent dot), the wordmark
 * fades in and stays on screen so the name is clearly seen, and
 * the whole screen fades away after about 7 seconds. Light and
 * Apple-minimal — the idea only is borrowed from sites like Stake
 * (logo animation first, then the page), never their dark casino
 * look.
 *
 * Never blocks: a tap or click anywhere skips it at once, the
 * Escape key skips it too, and the CSS end-state is `visibility:
 * hidden`, so the page is usable even if the timer never fires.
 * `prefers-reduced-motion` skips the animation entirely (duration
 * 0, `onDone` at once). `onDone` fires exactly once, however the
 * splash ends.
 */
export function LogoSplash({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = splashDurationMs(reduced);
    if (duration === 0) {
      finish();
      return;
    }
    const timer = window.setTimeout(finish, duration);
    const onKeyDown = (event: KeyboardEvent) => {
      if (isSplashSkipKey(event.key)) finish();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [finish]);

  return (
    <div
      aria-hidden="true"
      onClick={finish}
      className="splash-screen fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-4 bg-surface"
    >
      <svg
        className="splash-mark"
        width="88"
        height="88"
        viewBox="0 0 64 64"
        role="img"
        aria-label="Qovu"
      >
        {/* Same geometry as public/favicon.svg: one circle, one short
            tail, one accent-blue dot at the centre. */}
        <circle
          className="splash-ring"
          cx="30"
          cy="28"
          r="19"
          fill="none"
          stroke="#111111"
          strokeWidth="6"
        />
        <line
          className="splash-tail"
          x1="43"
          y1="41"
          x2="53"
          y2="53"
          stroke="#111111"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle className="splash-dot" cx="30" cy="28" r="5.5" fill="#0071e3" />
      </svg>
      <p className="splash-word text-[22px] font-semibold tracking-tight text-ink">Qovu</p>
      <p className="splash-skip text-[13px] text-faint">Tap anywhere to continue</p>
    </div>
  );
}
