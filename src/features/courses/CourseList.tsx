import { useState } from 'react';
import { useAssignments, type AssignedCourse } from '@/hooks/useAssignments';
import { CourseForm } from './CourseForm';
import { CourseStudents } from '@/features/students/CourseStudents';
import { CourseEligibility } from '@/features/eligibility/CourseEligibility';
import { CourseExport } from '@/features/reports/CourseExport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { CourseListSkeleton } from '@/components/ui/skeleton';

/**
 * Courses the signed-in lecturer is assigned to, loaded through
 * `lecturer_assignments` (via RLS). Each course shows its department
 * and semester names, and the list can be filtered by department.
 * Unassigned courses are never shown.
 *
 * Since v0.4.0 a lecturer can also create a course (department,
 * semester, code, title, level, credit units) through the
 * server-side `create_lecturer_course` RPC, which creates their
 * own assignment to the course at the same time.
 */
export function CourseList() {
  const [refreshKey, setRefreshKey] = useState(0);
  const state = useAssignments(refreshKey);
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  // A course's Students view (v0.9.0), Eligibility view (v0.11.0)
  // and Exports view (v0.14.0): the class list, the 75% check and
  // the exports live inside their course — there is no separate
  // top-level nav item for any of them.
  const [selectedCourse, setSelectedCourse] = useState<AssignedCourse | null>(null);
  const [selectedView, setSelectedView] = useState<'students' | 'eligibility' | 'exports'>('students');

  if (state.status === 'not-configured') {
    return (
      <EmptyState
        title="Supabase is not configured yet"
        description="Supabase is not connected yet."
      />
    );
  }
  if (state.status === 'loading') return <CourseListSkeleton />;
  if (state.status === 'error') return <ErrorState message={state.message} />;
  if (state.status === 'no-profile') {
    return (
      <EmptyState
        title="No lecturer profile found"
        description="Your account has no lecturer profile yet. Ask your university administrator to create one for your account."
      />
    );
  }

  const { departments, courses, profile } = state.data;

  if (selectedCourse) {
    if (selectedView === 'eligibility') {
      return (
        <CourseEligibility
          course={selectedCourse}
          onBack={() => setSelectedCourse(null)}
        />
      );
    }
    if (selectedView === 'exports') {
      return (
        <CourseExport
          course={selectedCourse}
          lecturerName={profile.full_name}
          onBack={() => setSelectedCourse(null)}
        />
      );
    }
    return (
      <CourseStudents
        course={selectedCourse}
        onBack={() => setSelectedCourse(null)}
      />
    );
  }

  const filtered = departmentFilter
    ? courses.filter((c) => c.department_id === departmentFilter)
    : courses;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-muted">
          {courses.length === 0
            ? 'No courses yet.'
            : `${courses.length} course${courses.length === 1 ? '' : 's'}`}
        </p>
        {!showForm ? (
          <Button type="button" onClick={() => setShowForm(true)}>
            New course
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <CourseForm
          onCreated={() => setRefreshKey((k) => k + 1)}
          onCancel={() => setShowForm(false)}
        />
      ) : null}

      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="You have no courses yet. Create your first course above — it will be assigned to you."
        />
      ) : (
        <>
          <label className="flex w-full flex-col gap-1.5 text-[13px] font-medium text-ink sm:max-w-xs">
            Filter by department
            <select
              className="h-11 rounded-lg border border-line bg-surface px-3 text-base text-ink md:h-9 md:text-sm"
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
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setSelectedView('students');
                          setSelectedCourse(course);
                        }}
                      >
                        Students
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setSelectedView('eligibility');
                          setSelectedCourse(course);
                        }}
                      >
                        Eligibility
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setSelectedView('exports');
                          setSelectedCourse(course);
                        }}
                      >
                        Exports
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
