import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { NAV_TITLES, type NavKey } from './routes';
import { Overview } from './Overview';
import { MobileNav, Sidebar } from '@/components/layout/Sidebar';
import { SignInForm } from '@/features/authentication/SignInForm';
import { DepartmentList } from '@/features/departments/DepartmentList';
import { CourseList } from '@/features/courses/CourseList';
import { SessionWorkspace } from '@/features/attendance/SessionWorkspace';
import { HistoryList } from '@/features/history/HistoryList';
import { ReportsPanel } from '@/features/reports/ReportsPanel';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/empty-state';

export function AppShell() {
  const [current, setCurrent] = useState<NavKey>('overview');
  const auth = useAuth();

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
          <h1 className="text-2xl font-semibold tracking-tight text-ink">UniAttend</h1>
          <p className="mt-1 text-[13px] text-muted">Lecturer Portal</p>
        </div>
        <EmptyState
          title="Supabase is not configured yet"
          description="Copy .env.example to .env and add your Supabase project URL and anon key, then reload. Sign-in is unavailable until then."
        />
      </div>
    );
  }

  if (auth.status === 'signed-out') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">UniAttend</h1>
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
        <MobileNav current={current} onNavigate={setCurrent} />
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
        <main className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6">
          {current === 'overview' ? <Overview /> : null}
          {current === 'departments' ? <DepartmentList /> : null}
          {current === 'courses' ? <CourseList /> : null}
          {current === 'sessions' ? <SessionWorkspace /> : null}
          {current === 'history' ? <HistoryList /> : null}
          {current === 'reports' ? <ReportsPanel /> : null}
          {current === 'profile' ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-[15px] text-ink">{auth.session.user.email ?? 'Signed in'}</p>
              <p className="text-[13px] text-muted">
                Profile editing and settings are part of the Phase 1 foundation and will be expanded with lecturer profile fields.
              </p>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
