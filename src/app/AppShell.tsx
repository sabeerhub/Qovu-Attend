import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getSubmitRoute } from '@/lib/edgeFunctions';
import { AUTH_VIEW_PATHS, getAuthView, type AuthView } from '@/lib/authRoutes';
import { useAuth } from '@/hooks/useAuth';
import { NAV_TITLES, type NavKey } from './routes';
import { Overview } from './Overview';
import { MobileNav, Sidebar } from '@/components/layout/Sidebar';
import { SignInForm } from '@/features/authentication/SignInForm';
import { SignUpForm } from '@/features/authentication/SignUpForm';
import { LandingPage } from '@/features/landing/LandingPage';
import { ContactPage } from '@/features/contact/ContactPage';
import { PrivacyPage } from '@/features/legal/PrivacyPage';
import { TermsPage } from '@/features/legal/TermsPage';
import type { PublicPageNav } from '@/components/layout/PublicPageLayout';
import { SubmitAttendance } from '@/features/submission/SubmitAttendance';
import { SubmitEntry } from '@/features/submission/SubmitEntry';
import { DepartmentList } from '@/features/departments/DepartmentList';
import { CourseList } from '@/features/courses/CourseList';
import { LecturePlanScreen } from '@/features/plan/LecturePlanScreen';
import { SessionWorkspace } from '@/features/attendance/SessionWorkspace';
import type { CreatedDraftSession } from '@/lib/sessionCreation';
import { HistoryList } from '@/features/history/HistoryList';
import { ReportsPanel } from '@/features/reports/ReportsPanel';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QovuBrand } from '@/components/brand/QovuBrand';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';

export function AppShell() {
  const [current, setCurrent] = useState<NavKey>('overview');
  const auth = useAuth();

  // A draft session just created from My Lecture Plan: the Sessions
  // screen opens it straight into the monitor, so the lecturer
  // reviews the headcount and activates without hunting the list.
  const [pendingSession, setPendingSession] = useState<CreatedDraftSession | null>(null);

  // Lecturer-portal auth view (v0.7.0): the landing page at `/`,
  // sign-in at `/signin`, sign-up at `/signup`. The view is kept in
  // state and mirrored to the URL so the back button works; the
  // public student submission routes above take precedence.
  const [authView, setAuthView] = useState<AuthView>(() =>
    typeof window !== 'undefined' ? getAuthView(window.location.pathname) : 'landing',
  );
  const goAuth = useCallback((view: AuthView) => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', AUTH_VIEW_PATHS[view]);
    }
    setAuthView(view);
  }, []);
  useEffect(() => {
    function onPopState() {
      setAuthView(getAuthView(window.location.pathname));
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Public student submission is rendered without sign-in and
  // before any auth gate. A QR link (`?submit=<sessionId>`) shows
  // the attendance form; `/submit` with no session shows the
  // passcode entry page (v0.5.4). Both ask only for a registration
  // number and expose no other session's data.
  const submitRoute =
    typeof window !== 'undefined'
      ? getSubmitRoute(window.location.pathname, window.location.search)
      : null;
  if (submitRoute?.kind === 'session') {
    return (
      <div className="min-h-screen bg-surface">
        <SubmitAttendance />
      </div>
    );
  }
  if (submitRoute?.kind === 'entry') {
    return (
      <div className="min-h-screen bg-surface">
        <SubmitEntry />
      </div>
    );
  }

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <LoadingState label="Loading…" />
      </div>
    );
  }

  if (auth.status === 'not-configured') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            <QovuBrand markSize={28} textClassName="text-2xl" />
          </h1>
          <p className="mt-1 text-[13px] text-muted">Lecturer Portal</p>
        </div>
        <EmptyState
          title="Supabase is not configured yet"
          description="Supabase is not connected yet. Sign-in is unavailable until then."
        />
      </div>
    );
  }

  if (auth.status === 'signed-out') {
    // Shared navigation for every public page (v0.8.2): landing,
    // contact, privacy, terms, sign-in and sign-up all move through
    // the same state machine, so the back button works everywhere.
    const publicNav: PublicPageNav = {
      onHome: () => goAuth('landing'),
      onSignIn: () => goAuth('signin'),
      onSignUp: () => goAuth('signup'),
      onContact: () => goAuth('contact'),
      onPrivacy: () => goAuth('privacy'),
      onTerms: () => goAuth('terms'),
    };
    if (authView === 'landing') {
      return (
        <LandingPage
          onSignIn={() => goAuth('signin')}
          onSignUp={() => goAuth('signup')}
          onContact={() => goAuth('contact')}
          onPrivacy={() => goAuth('privacy')}
          onTerms={() => goAuth('terms')}
        />
      );
    }
    if (authView === 'contact') {
      return <ContactPage nav={publicNav} />;
    }
    if (authView === 'privacy') {
      return <PrivacyPage nav={publicNav} />;
    }
    if (authView === 'terms') {
      return <TermsPage nav={publicNav} />;
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            <QovuBrand markSize={28} textClassName="text-2xl" />
          </h1>
          <p className="mt-1 text-[13px] text-muted">Lecturer Portal</p>
        </div>
        {authView === 'signup' ? (
          <SignUpForm onSignIn={() => goAuth('signin')} onPrivacy={() => goAuth('privacy')} onTerms={() => goAuth('terms')} />
        ) : (
          <SignInForm onSignUp={() => goAuth('signup')} onPrivacy={() => goAuth('privacy')} onTerms={() => goAuth('terms')} />
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar current={current} onNavigate={setCurrent} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-6 md:py-5">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{NAV_TITLES[current]}</h1>
          {/* Icon-only sign-out (v0.13.1): signs out immediately,
              exactly as the old text button did — there is no
              confirmation step anywhere today. */}
          <Button
            variant="ghost"
            aria-label="Sign out"
            title="Sign out"
            className="h-11 w-11 rounded-full p-0"
            onClick={() => {
              void supabase?.auth.signOut();
            }}
          >
            <LogOut size={22} aria-hidden="true" />
          </Button>
        </header>
        <main className="mx-auto w-full max-w-[1120px] px-4 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-6 md:py-8 md:pb-8">
          {current === 'overview' ? <Overview /> : null}
          {current === 'departments' ? <DepartmentList /> : null}
          {current === 'courses' ? <CourseList /> : null}
          {current === 'plan' ? (
            <LecturePlanScreen
              onOpenSession={(session) => {
                setPendingSession(session);
                setCurrent('sessions');
              }}
            />
          ) : null}
          {current === 'sessions' ? (
            <SessionWorkspace
              initialSession={
                pendingSession
                  ? {
                      session: pendingSession,
                      courseCode: pendingSession.courses?.code ?? null,
                    }
                  : null
              }
              onInitialSessionConsumed={() => setPendingSession(null)}
            />
          ) : null}
          {current === 'history' ? <HistoryList /> : null}
          {current === 'reports' ? <ReportsPanel /> : null}
          {current === 'profile' ? <ProfileScreen /> : null}
        </main>
        {/* Floating pill tab bar on mobile; the pb-24 above keeps it
            from ever covering content. Desktop uses the sidebar. */}
        <MobileNav
          current={current}
          onNavigate={setCurrent}
          onSignOut={() => {
            void supabase?.auth.signOut();
          }}
        />
      </div>
    </div>
  );
}
