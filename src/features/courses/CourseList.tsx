import { useState } from 'react';
import { useAssignments } from '@/hooks/useAssignments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';

/**
 * Courses the signed-in lecturer is assigned to, loaded through
 * `lecturer_assignments` (via RLS). Each course shows its department
 * and semester names, and the list can be filtered by department.
 * Unassigned courses are never shown.
 */
export function CourseList() {
  const state = useAssignments();
  const [departmentFilter, setDepartmentFilter] = useState<string>('');

  if (state.status === 'not-configured') {
    return (
      <EmptyState
        title="Supabase is not configured yet"
        description="Supabase is not connected yet."
      />
    );
  }
  if (state.status === 'loading') return <LoadingState label="Loading courses…" />;
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
  if (courses.length === 0) {
    return (
      <EmptyState
        title="No courses yet"
        description="You have no course assignments yet. Assignments are made by your university administrator."
      />
    );
  }

  const filtered = departmentFilter
    ? courses.filter((c) => c.department_id === departmentFilter)
    : courses;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex max-w-xs flex-col gap-1.5 text-[13px] font-medium text-ink">
        Filter by department
        <select
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
        >
          <option value="">All departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </label>

      {filtered.length === 0 ? (
        <EmptyState
          title="No courses in this department"
          description="You have no course assignments in the selected department."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <Card key={course.id}>
              <CardHeader>
                <CardTitle>
                  {course.code} — {course.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] text-muted">
                  {course.departmentName} · {course.semesterName}
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  Level {course.level}
                  {course.credit_unit !== null
                    ? ` · ${course.credit_unit} credit unit${course.credit_unit === 1 ? '' : 's'}`
                    : ''}
                  {` · ${course.academicSessionName}`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
