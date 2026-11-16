/**
 * Logo splash timing (v0.8.1).
 *
 * The splash is a calm brand moment on first load: the Qovu Q mark
 * draws in, the "Qovu" wordmark fades in and stays on screen so the
 * name is clearly seen, then the screen fades away. It plays for
 * about 7 seconds (the owner's rule: 6 to 10 seconds, so the name
 * is displayed) and never blocks: a tap or click anywhere — or the
 * Escape key — skips it at once, and the component also hides itself
 * with a CSS `visibility: hidden` end-state, so even if the timer
 * callback never fires the page stays usable. People who prefer
 * reduced motion skip it entirely.
 */

/** How long the splash plays, in milliseconds. */
export const SPLASH_DURATION_MS = 7000;

/** Milliseconds the splash should play for this visitor. */
export function splashDurationMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : SPLASH_DURATION_MS;
}

/** True when the splash should be skipped (reduced motion). */
export function splashShouldSkip(reducedMotion: boolean): boolean {
  return splashDurationMs(reducedMotion) === 0;
}

/** True when a pressed key should skip the splash (Escape only). */
export function isSplashSkipKey(key: string): boolean {
  return key === 'Escape';
}
