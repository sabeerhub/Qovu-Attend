import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Department } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';

/** Departments the signed-in lecturer is assigned to (via RLS). */
export function DepartmentList() {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; departments: Department[] }
  >({ status: 'loading' });

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('id, faculty_id, name, code, created_at')
          .order('name');
        if (error) setState({ status: 'error', message: error.message });
        else setState({ status: 'ready', departments: (data ?? []) as Department[] });
      } catch (err: unknown) {
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not load departments.' });
      }
    })();
  }, []);

  if (state.status === 'loading') return <LoadingState label="Loading departments…" />;
  if (state.status === 'error') return <ErrorState message={state.message} />;
  if (state.departments.length === 0) {
    return (
      <EmptyState
        title="No departments yet"
        description="You have no department assignments yet. Assignments are made by your university administrator."
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {state.departments.map((dept) => (
        <Card key={dept.id}>
          <CardHeader>
            <CardTitle>{dept.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[13px] text-muted">{dept.code ?? 'No code'}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
