/**
 * Reports & Exports (v0.14.0) — one export per assigned course.
 *
 * Pick a course to export it: the spreadsheet file keeps every
 * session's detail, and the printed report is the summary (session
 * list + each student's attended, held and percentage). A single
 * session's export lives in the session workspace instead.
 *
 * Everything here is scoped to the lecturer's own assignments —
 * the course list comes from `lecturer_assignments` (via RLS),
 * and the export itself loads only that course's sessions,
 * records and class list.
 */
import { useState } from 'react';
import { useAssignments, type AssignedCourse } from '@/hooks/useAssignments';
import { CourseExport } from './CourseExport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { CourseListSkeleton } from '@/components/ui/skeleton';

export function ReportsPanel() {
  const state = useAssignments();
  const [selectedCourse, setSelectedCourse] = useState<AssignedCourse | null>(null);

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

  const { profile, courses } = state.data;

  if (selectedCourse) {
    return (
      <CourseExport
        course={selectedCourse}
        lecturerName={profile.full_name}
        onBack={() => setSelectedCourse(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        Export a course&rsquo;s attendance. The spreadsheet keeps every session&rsquo;s detail;
        the printed report is the summary. Only your own assigned courses appear here.
      </p>
      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="You have no courses yet. Create your first course — it will be assigned to you."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
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
                  Level {course.level} · {course.academicSessionName}
                </p>
                <div className="mt-3">
                  <Button type="button" variant="secondary" onClick={() => setSelectedCourse(course)}>
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
