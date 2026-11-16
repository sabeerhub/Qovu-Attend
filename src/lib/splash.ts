/**
 * Logo splash timing (v0.7.0).
 *
 * The splash is a short brand moment on first load: the Qovu Q mark
 * draws in, then the page fades in underneath. It is deliberately
 * short (1.3 s) and never blocks: the component also hides itself
 * with a CSS `visibility: hidden` end-state, so even if the timer
 * callback never fires the page stays usable. People who prefer
 * reduced motion skip it entirely.
 */

/** How long the splash plays, in milliseconds. */
export const SPLASH_DURATION_MS = 1300;

/** Milliseconds the splash should play for this visitor. */
export function splashDurationMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : SPLASH_DURATION_MS;
}

/** True when the splash should be skipped (reduced motion). */
export function splashShouldSkip(reducedMotion: boolean): boolean {
  return splashDurationMs(reducedMotion) === 0;
}
