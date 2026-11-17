/**
 * Lecturer-portal auth routing (v0.7.0) + public pages (v0.8.2).
 *
 * Signed-out visitors see the public landing page at `/`; the
 * sign-in and sign-up screens live at `/signin` and `/signup`; the
 * public Contact, Privacy Policy and Terms pages live at
 * `/contact`, `/privacy` and `/terms`. This is a tiny path-based
 * router, not a framework: AppShell keeps the current view in state
 * and `pushState`s the matching path so the URL stays shareable
 * and the back button works. The public student submission routes
 * (`/submit`, `?submit=...`) are decided earlier by
 * `getSubmitRoute` and never reach this router.
 */

export type AuthView = 'landing' | 'signin' | 'signup' | 'contact' | 'privacy' | 'terms';

export const AUTH_VIEW_PATHS: Record<AuthView, string> = {
  landing: '/',
  signin: '/signin',
  signup: '/signup',
  contact: '/contact',
  privacy: '/privacy',
  terms: '/terms',
};

/** Which auth view a path is. Anything unknown is the landing page. */
export function getAuthView(pathname: string): AuthView {
  if (pathname === '/signup') return 'signup';
  if (pathname === '/signin') return 'signin';
  if (pathname === '/contact') return 'contact';
  if (pathname === '/privacy') return 'privacy';
  if (pathname === '/terms') return 'terms';
  return 'landing';
}
