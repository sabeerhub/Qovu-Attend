import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getSubmitRoute } from '@/lib/edgeFunctions';
import { useAuth } from '@/hooks/useAuth';
import { NAV_TITLES, type NavKey } from './routes';
import { Overview } from './Overview';
import { MobileNav, Sidebar } from '@/components/layout/Sidebar';
import { SignInForm } from '@/features/authentication/SignInForm';
import { SubmitAttendance } from '@/features/submission/SubmitAttendance';
import { SubmitEntry } from '@/features/submission/SubmitEntry';
import { DepartmentList } from '@/features/departments/DepartmentList';
import { CourseList } from '@/features/courses/CourseList';
import { SessionWorkspace } from '@/features/attendance/SessionWorkspace';
import { HistoryList } from '@/features/history/HistoryList';
import { ReportsPanel } from '@/features/reports/ReportsPanel';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { Button } from '@/components/ui/button';
import { QovuBrand } from '@/components/brand/QovuBrand';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';

export function AppShell() {
  const [current, setCurrent] = useState<NavKey>('overview');
  const auth = useAuth();

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
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            <QovuBrand markSize={28} textClassName="text-2xl" />
          </h1>
          <p className="mt-1 text-[13px] text-muted">Lecturer Portal</p>
        </div>
        <SignInForm />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar current={current} onNavigate={setCurrent} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line px-4 py-4 md:px-6">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{NAV_TITLES[current]}</h1>
          <Button
            variant="ghost"
            onClick={() => {
              void supabase?.auth.signOut();
            }}
          >
            Sign out
          </Button>
        </header>
        <main className="mx-auto w-full max-w-[1120px] px-4 py-6 pb-24 md:px-6 md:pb-6">
          {current === 'overview' ? <Overview /> : null}
          {current === 'departments' ? <DepartmentList /> : null}
          {current === 'courses' ? <CourseList /> : null}
          {current === 'sessions' ? <SessionWorkspace /> : null}
          {current === 'history' ? <HistoryList /> : null}
          {current === 'reports' ? <ReportsPanel /> : null}
          {current === 'profile' ? <ProfileScreen /> : null}
        </main>
        {/* Fixed bottom tab bar on mobile; the pb-24 above keeps it
            from ever covering content. Desktop uses the sidebar. */}
        <MobileNav current={current} onNavigate={setCurrent} />
      </div>
    </div>
  );
}
