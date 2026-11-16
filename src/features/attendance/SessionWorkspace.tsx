import { useState } from 'react';
import { useAssignments } from '@/hooks/useAssignments';
import { SessionForm } from './SessionForm';
import { SessionList } from './SessionList';
import { SessionMonitor, type ActivationResult } from './SessionMonitor';
import { AcademicCalendarView } from '@/features/calendar/AcademicCalendarView';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { SessionWorkspaceSkeleton } from '@/components/ui/skeleton';
import type { AttendanceSession } from '@/types/database';

interface SelectedSession {
  session: AttendanceSession;
  courseCode: string | null;
  activation: ActivationResult | null;
}

/**
 * Session workspace: assignment-driven session creation (department
 * and course from the lecturer's own assignments), the lecturer's
 * session list, and the academic calendar the dates are validated
 * against. If there is no assignment, creation is impossible — and
 * the UI says so instead of inventing a course.
 *
 * Opening a session shows its monitor (Phase 2): live counts, the
 * submitted registration numbers, manual attendance, corrections and
 * the lifecycle controls. Activating a Draft from the list opens the
 * monitor with the QR code + passcode shown once.
 */
export function SessionWorkspace() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<SelectedSession | null>(null);
  const state = useAssignments();

  if (state.status === 'not-configured') {
    return (
      <EmptyState
        title="Supabase is not configured yet"
        description="Supabase is not connected yet."
      />
    );
  }
  if (state.status === 'loading') return <SessionWorkspaceSkeleton />;
  if (state.status === 'error') return <ErrorState message={state.message} />;
  if (state.status === 'no-profile') {
    return (
      <EmptyState
        title="No lecturer profile found"
        description="Your account has no lecturer profile yet. Ask your university administrator to create one for your account."
      />
    );
  }

  const { profile, departments, courses, rooms, academicSessions } = state.data;
  const hasAssignments = departments.length > 0 && courses.length > 0;

  if (selected) {
    return (
      <SessionMonitor
        session={selected.session}
        courseCode={selected.courseCode}
        initialActivation={selected.activation}
        onBack={() => setSelected(null)}
        onSessionChanged={() => setRefreshKey((k) => k + 1)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-4 text-[17px] font-semibold">New session</h2>
        {hasAssignments ? (
          <SessionForm
            departments={departments}
            courses={courses}
            rooms={rooms}
            lecturerId={profile.id}
            onCreated={() => setRefreshKey((k) => k + 1)}
          />
        ) : (
          <EmptyState
            title="No course assignments yet"
            description="You need a course assignment to create an attendance session. Assignments are made by your university administrator."
          />
        )}
      </section>
      <section>
        <h2 className="mb-4 text-[17px] font-semibold">Your sessions</h2>
        <SessionList
          refreshKey={refreshKey}
          onSelect={(session, activation) =>
            setSelected({
              session,
              courseCode: session.courses?.code ?? null,
              activation,
            })
          }
        />
      </section>
      <section>
        <h2 className="mb-4 text-[17px] font-semibold">Academic calendar</h2>
        <AcademicCalendarView academicSessions={academicSessions} />
      </section>
    </div>
  );
}
