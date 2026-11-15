import { useState } from 'react';
import { useAssignments } from '@/hooks/useAssignments';
import { DepartmentWorkspace } from './DepartmentWorkspace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';

/**
 * Departments the signed-in lecturer is assigned to, loaded through
 * `lecturer_assignments` (via RLS). Selecting a department opens its
 * workspace. Unassigned departments are never shown.
 */
export function DepartmentList() {
  const state = useAssignments();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (state.status === 'not-configured') {
    return (
      <EmptyState
        title="Supabase is not configured yet"
        description="Supabase is not connected yet."
      />
    );
  }
  if (state.status === 'loading') return <LoadingState label="Loading departments…" />;
  if (state.status === 'error') return <ErrorState message={state.message} />;
  if (state.status === 'no-profile') {
    return (
      <EmptyState
        title="No lecturer profile found"
        description="Your account has no lecturer profile yet. Ask your university administrator to create one for your account."
      />
    );
  }

  const { departments, courses } = state.data;
  const selected = departments.find((d) => d.id === selectedId);
  if (selected) {
    return (
      <DepartmentWorkspace
        department={selected}
        courses={courses.filter((c) => c.department_id === selected.id)}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  if (departments.length === 0) {
    return (
      <EmptyState
        title="No departments yet"
        description="You have no department assignments yet. Assignments are made by your university administrator."
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {departments.map((dept) => {
        const deptCourses = courses.filter((c) => c.department_id === dept.id);
        return (
          <Card key={dept.id}>
            <CardHeader>
              <CardTitle>{dept.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-2">
              <p className="text-[13px] text-muted">
                {dept.facultyName ?? 'No faculty recorded'}
                {dept.code ? ` · ${dept.code}` : ''}
              </p>
              <p className="text-[13px] text-muted">
                {deptCourses.length} assigned course{deptCourses.length === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                onClick={() => setSelectedId(dept.id)}
                className="text-[14px] font-medium text-accent hover:underline"
              >
                Open workspace
              </button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
