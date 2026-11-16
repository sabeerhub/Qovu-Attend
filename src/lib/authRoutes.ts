/**
 * Lecturer-portal auth routing (v0.7.0).
 *
 * Signed-out visitors see the public landing page at `/`; the
 * sign-in and sign-up screens live at `/signin` and `/signup`.
 * This is a tiny path-based router, not a framework: AppShell
 * keeps the current view in state and `pushState`s the matching
 * path so the URL stays shareable and the back button works.
 * The public student submission routes (`/submit`,
 * `?submit=...`) are decided earlier by `getSubmitRoute` and
 * never reach this router.
 */

export type AuthView = 'landing' | 'signin' | 'signup';

export const AUTH_VIEW_PATHS: Record<AuthView, string> = {
  landing: '/',
  signin: '/signin',
  signup: '/signup',
};

/** Which auth view a path is. Anything unknown is the landing page. */
export function getAuthView(pathname: string): AuthView {
  if (pathname === '/signup') return 'signup';
  if (pathname === '/signin') return 'signin';
  return 'landing';
}
