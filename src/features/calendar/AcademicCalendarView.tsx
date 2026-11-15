import { weekForDate } from '@/lib/calendar';
import type { AcademicSessionWithSemesters } from '@/hooks/useAssignments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Academic calendar (Phase 1): the academic sessions and semesters
 * referenced by the lecturer's assigned courses, with their dates
 * and the current teaching week (week 1 = first 7 days from the
 * semester start). Session creation validates the lecture date and
 * week number against these dates.
 */
export function AcademicCalendarView({
  academicSessions,
}: {
  academicSessions: AcademicSessionWithSemesters[];
}) {
  if (academicSessions.length === 0) {
    return (
      <EmptyState
        title="No academic calendar yet"
        description="No academic sessions or semesters are configured for your assigned courses yet. Your university administrator configures the academic calendar."
      />
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      {academicSessions.map((session) => (
        <Card key={session.id}>
          <CardHeader>
            <CardTitle>{session.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-[13px] text-muted">
              {session.start_date} to {session.end_date}
            </p>
            {session.semesters.length === 0 ? (
              <p className="text-[13px] text-muted">No semesters configured for this session.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {session.semesters.map((semester) => {
                  const currentWeek = weekForDate(semester, today);
                  return (
                    <li key={semester.id} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
                      <p className="text-[15px] text-ink">{semester.name}</p>
                      <p className="text-[13px] text-muted">
                        {semester.start_date} to {semester.end_date} · 15 teaching weeks
                      </p>
                      <p className="text-[13px] text-muted">
                        {currentWeek !== null
                          ? `Today is week ${currentWeek} of this semester.`
                          : 'Today is outside this semester.'}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
