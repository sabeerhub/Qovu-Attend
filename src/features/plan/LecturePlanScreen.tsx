import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAssignments } from '@/hooks/useAssignments';
import {
  dayName,
  groupPlansByDay,
  sessionInputForPlanEntry,
  toHHMM,
  type LecturePlanRow,
} from '@/lib/lecturePlan';
import { createDraftSession, type CreatedDraftSession } from '@/lib/sessionCreation';
import {
  hasSessionFormErrors,
  validateSessionForm,
} from '@/lib/sessionForm';
import { LecturePlanForm, initialFromPlan } from './LecturePlanForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LecturePlanSkeleton } from '@/components/ui/skeleton';

interface PlanCourseJoin {
  id: string;
  code: string;
  title: string;
  level: number;
  departments: { name: string } | null;
}

interface PlanRowRaw {
  id: string;
  lecturer_id: string;
  course_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string | null;
  room: string | null;
  created_at: string;
  updated_at: string;
  courses: PlanCourseJoin | null;
}

/**
 * My Lecture Plan: the lecturer's own weekly timetable (Monday to
 * Saturday). Each planned lecture is a course + day + start time,
 * with an optional end time and room. Only the lecturer's own rows
 * ever load here (RLS); another lecturer's plan is never visible.
 *
 * Adding goes through the server-side `create_lecture_plan` RPC;
 * editing and deleting are RLS-guarded to the owner's own rows.
 *
 * "Start session" turns one planned lecture into a Draft attendance
 * session (date = the next occurrence of its weekday, never a past
 * date; start time and week prefilled from the plan) and hands the
 * created session to `onOpenSession`, which takes the lecturer
 * straight into the session workspace to review the headcount and
 * activate. The plan only prefills — it never decides.
 */
export function LecturePlanScreen({
  onOpenSession,
}: {
  onOpenSession?: (session: CreatedDraftSession) => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LecturePlanRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const assignments = useAssignments(refreshKey);
  const [plansState, setPlansState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; plans: LecturePlanRow[] }
  >({ status: 'loading' });

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('lecture_plans')
          .select(
            'id, lecturer_id, course_id, day_of_week, start_time, end_time, room, created_at, updated_at, ' +
              'courses(id, code, title, level, departments(name))',
          )
          .order('day_of_week')
          .order('start_time');
        if (error) throw new Error(error.message);
        const plans: LecturePlanRow[] = ((data ?? []) as unknown as PlanRowRaw[]).map(
          (row) => {
            const { courses, ...rest } = row;
            return {
              ...rest,
              course: courses
                ? {
                    id: courses.id,
                    code: courses.code,
                    title: courses.title,
                    level: courses.level,
                    departmentName: courses.departments?.name ?? 'Unknown department',
                  }
                : null,
            };
          },
        );
        if (!cancelled) setPlansState({ status: 'ready', plans });
      } catch (err: unknown) {
        if (!cancelled) {
          setPlansState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load your plan.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (assignments.status === 'not-configured') {
    return (
      <EmptyState
        title="Supabase is not configured yet"
        description="Supabase is not connected yet."
      />
    );
  }
  if (assignments.status === 'loading' || plansState.status === 'loading') {
    return <LecturePlanSkeleton />;
  }
  if (assignments.status === 'error') {
    return <ErrorState message={assignments.message} />;
  }
  if (plansState.status === 'error') {
    return <ErrorState message={plansState.message} />;
  }
  if (assignments.status === 'no-profile') {
    return (
      <EmptyState
        title="No lecturer profile found"
        description="Your account has no lecturer profile yet. Ask your university administrator to create one for your account."
      />
    );
  }

  const { profile, courses } = assignments.data;
  const plans = plansState.status === 'ready' ? plansState.plans : [];
  const grouped = groupPlansByDay(plans);
  const hasCourses = courses.length > 0;

  async function onDelete(plan: LecturePlanRow) {
    if (!supabase) return;
    setActionError(null);
    setDeletingId(plan.id);
    const { error } = await supabase.from('lecture_plans').delete().eq('id', plan.id);
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (error) {
      setActionError(error.message);
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  /**
   * Turn one planned lecture into a Draft session and open it in
   * the session workspace. The date is the next occurrence of the
   * entry's weekday (today when it is today); the week is suggested
   * from the course semester; the title is the course title. The
   * lecturer reviews the headcount and activates from the monitor —
   * nothing here is final.
   */
  async function onStartSession(plan: LecturePlanRow) {
    if (!supabase) return;
    setActionError(null);
    const course = courses.find((c) => c.id === plan.course_id) ?? null;
    if (!course) {
      setActionError('This course is no longer in your assignments.');
      return;
    }
    const input = sessionInputForPlanEntry(plan, course, new Date());
    const errors = validateSessionForm({
      departmentId: course.department_id,
      courseId: course.id,
      title: input.title,
      lectureDate: input.lectureDate,
      startTime: input.startTime,
      weekNumber: input.weekNumber,
      headcount: null,
      qrExpiresInSeconds: input.qrExpiresInSeconds,
      lectureRoomId: null,
    });
    if (hasSessionFormErrors(errors)) {
      setActionError(
        'This lecture could not be turned into a session. Check the plan entry and try again.',
      );
      return;
    }
    setStartingId(plan.id);
    const result = await createDraftSession(supabase, {
      ...input,
      lecturerId: profile.id,
    });
    setStartingId(null);
    if ('error' in result) {
      setActionError(result.error);
      return;
    }
    onOpenSession?.(result.session);
  }

  function timeRange(plan: LecturePlanRow): string {
    const start = toHHMM(plan.start_time);
    const end = plan.end_time ? toHHMM(plan.end_time) : '';
    return end ? `${start} – ${end}` : start;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-muted">
          {plans.length === 0
            ? 'No lectures planned yet.'
            : `${plans.length} planned lecture${plans.length === 1 ? '' : 's'}`}
        </p>
        {!showForm && !editing && hasCourses ? (
          <Button type="button" onClick={() => setShowForm(true)}>
            Add lecture
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <LecturePlanForm
          courses={courses}
          onSaved={() => {
            setShowForm(false);
            setRefreshKey((k) => k + 1);
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : null}

      {editing ? (
        <LecturePlanForm
          courses={courses}
          initial={initialFromPlan(editing)}
          onSaved={() => {
            setEditing(null);
            setRefreshKey((k) => k + 1);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {!hasCourses && !showForm ? (
        <EmptyState
          title="No courses yet"
          description="You need a course before you can plan a lecture. Create a course first, then add it to your plan."
        />
      ) : plans.length === 0 ? (
        <EmptyState
          title="No lectures planned yet"
          description="Add your weekly lectures — course, day and time — and start a session from your plan with one tap when the lecture begins."
        />
      ) : (
        grouped.map(({ day, entries }) => (
          <section key={day}>
            <h2 className="mb-3 text-[17px] font-semibold">{dayName(day)}</h2>
            <div className="flex flex-col gap-3">
              {entries.map((plan) => (
                <Card key={plan.id}>
                  <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium text-ink">
                        {timeRange(plan)}
                        {plan.course
                          ? ` · ${plan.course.code} — ${plan.course.title}`
                          : ' · Unknown course'}
                      </p>
                      <p className="mt-1 text-[13px] text-muted">
                        {plan.course
                          ? `${plan.course.departmentName} · Level ${plan.course.level}`
                          : 'Course no longer available'}
                        {plan.room ? ` · ${plan.room}` : ''}
                      </p>
                      {confirmDeleteId === plan.id ? (
                        <p className="mt-2 text-[13px] text-danger" role="alert">
                          Delete this planned lecture? It will not delete the
                          course or any past attendance.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {confirmDeleteId === plan.id ? (
                        <>
                          <Button
                            type="button"
                            variant="danger"
                            disabled={deletingId === plan.id}
                            onClick={() => void onDelete(plan)}
                          >
                            {deletingId === plan.id ? 'Deleting…' : 'Yes, delete'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            disabled={startingId === plan.id}
                            onClick={() => void onStartSession(plan)}
                          >
                            {startingId === plan.id ? 'Starting…' : 'Start session'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setEditing(plan);
                              setShowForm(false);
                              setConfirmDeleteId(null);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setConfirmDeleteId(plan.id)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}

      {actionError ? (
        <p className="text-[13px] text-danger" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
