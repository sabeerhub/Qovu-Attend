import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Course } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';

/** Courses the signed-in lecturer is assigned to (via RLS). */
export function CourseList() {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; courses: Course[] }
  >({ status: 'loading' });

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('id, department_id, semester_id, code, title, level, credit_unit, created_at')
          .order('code');
        if (error) setState({ status: 'error', message: error.message });
        else setState({ status: 'ready', courses: (data ?? []) as Course[] });
      } catch (err: unknown) {
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not load courses.' });
      }
    })();
  }, []);

  if (state.status === 'loading') return <LoadingState label="Loading courses…" />;
  if (state.status === 'error') return <ErrorState message={state.message} />;
  if (state.courses.length === 0) {
    return (
      <EmptyState
        title="No courses yet"
        description="You have no course assignments yet. Assignments are made by your university administrator."
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {state.courses.map((course) => (
        <Card key={course.id}>
          <CardHeader>
            <CardTitle>
              {course.code} — {course.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[13px] text-muted">
              Level {course.level}
              {course.credit_unit !== null ? ` · ${course.credit_unit} credit unit${course.credit_unit === 1 ? '' : 's'}` : ''}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
