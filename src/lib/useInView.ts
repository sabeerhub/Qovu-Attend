import { useEffect, useRef, useState } from 'react';

/**
 * Scroll reveal (v0.8.2): cartoons and sections fade in with a
 * slight rise when they scroll into view, using
 * IntersectionObserver.
 *
 * Safety first: content is visible by default. It only starts
 * hidden when a working observer exists AND the visitor allows
 * motion. No observer, reduced motion, server render, or an
 * observer that throws — content simply appears, never hidden.
 */

export interface InViewEnvironment {
  observerAvailable: boolean;
  reducedMotion: boolean;
}

/**
 * Pure decision: should the content start visible? True unless a
 * working observer exists and motion is allowed — the only case
 * where hiding-then-revealing is safe.
 */
export function resolveInitialInView(env: InViewEnvironment): boolean {
  return !env.observerAvailable || env.reducedMotion;
}

/** CSS classes for the reveal state. */
export function revealClassName(inView: boolean): string {
  return inView ? 'reveal reveal-visible' : 'reveal';
}

/**
 * Observe one element; `inView` turns true once it scrolls into
 * view (15% visible) and stays true. Server-side render starts
 * visible — there is no window to observe from.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    return resolveInitialInView({
      observerAvailable: typeof IntersectionObserver !== 'undefined',
      reducedMotion,
    });
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    let observer: IntersectionObserver;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setInView(true);
            observer.disconnect();
          }
        },
        { threshold: 0.15 },
      );
      observer.observe(el);
    } catch {
      // An observer that cannot start must never hide content.
      setInView(true);
      return;
    }
    return () => observer.disconnect();
  }, [inView]);

  return { ref, inView };
}
