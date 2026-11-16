import { useEffect } from 'react';
import { splashDurationMs } from '@/lib/splash';

/**
 * Logo splash (v0.7.0): the first thing a visitor sees when they
 * open a Qovu link. Full-screen canvas white, the Q mark draws
 * itself in (ring, then tail, then the accent dot), the wordmark
 * fades in underneath, and the whole screen fades away into the
 * page. Light and Apple-minimal — the idea only is borrowed from
 * sites like Stake (logo animation first, then the page), never
 * their dark casino look.
 *
 * Never blocks: the parent unmounts this after `onDone`, and the
 * CSS end-state is `visibility: hidden`, so the page is usable
 * even if the timer never fires. `prefers-reduced-motion` skips
 * the animation entirely (duration 0, `onDone` at once).
 */
export function LogoSplash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = splashDurationMs(reduced);
    if (duration === 0) {
      onDone();
      return;
    }
    const timer = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      aria-hidden="true"
      className="splash-screen fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-surface"
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
    </div>
  );
}
