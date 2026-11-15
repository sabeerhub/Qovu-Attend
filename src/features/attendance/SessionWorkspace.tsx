import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SessionForm } from './SessionForm';
import { SessionList } from './SessionList';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';

/**
 * Session workspace: resolves the lecturer's first assigned course
 * (needed to create a Draft session) and renders the form + list.
 * If there is no assignment, creation is impossible — and the UI
 * says so instead of inventing a course.
 */
export function SessionWorkspace() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'no-assignment' }
    | { status: 'ready'; courseId: string; semesterId: string; lecturerId: string }
  >({ status: 'loading' });

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data: profile } = await supabase
        .from('lecturer_profiles')
        .select('id')
        .maybeSingle();
      const { data: assignment, error } = await supabase
        .from('lecturer_assignments')
        .select('course_id')
        .not('course_id', 'is', null)
        .limit(1)
        .maybeSingle();
      if (error) {
        setState({ status: 'error', message: error.message });
        return;
      }
      const courseId = assignment?.course_id as string | null | undefined;
      if (!profile || !courseId) {
        setState({ status: 'no-assignment' });
        return;
      }
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('semester_id')
        .eq('id', courseId)
        .maybeSingle();
      if (courseError || !course) {
        setState({ status: 'error', message: courseError?.message ?? 'Could not load the assigned course.' });
        return;
      }
      setState({
        status: 'ready',
        courseId,
        semesterId: course.semester_id as string,
        lecturerId: (profile as { id: string }).id,
      });
    })().catch((err: unknown) =>
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not load session workspace.' }),
    );
  }, []);

  if (state.status === 'loading') return <LoadingState label="Loading sessions…" />;
  if (state.status === 'error') return <ErrorState message={state.message} />;
  if (state.status === 'no-assignment') {
    return (
      <div className="flex flex-col gap-6">
        <EmptyState
          title="No course assignments yet"
          description="You need a course assignment to create an attendance session. Assignments are made by your university administrator."
        />
        <SessionList refreshKey={refreshKey} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-4 text-[17px] font-semibold">New session</h2>
        <SessionForm
          courseId={state.courseId}
          semesterId={state.semesterId}
          lecturerId={state.lecturerId}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
      </section>
      <section>
        <h2 className="mb-4 text-[17px] font-semibold">Your sessions</h2>
        <SessionList refreshKey={refreshKey} />
      </section>
    </div>
  );
}
