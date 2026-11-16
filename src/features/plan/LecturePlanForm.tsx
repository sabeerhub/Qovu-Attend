import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DAY_NAMES,
  createLecturePlan,
  hasLecturePlanFormErrors,
  toHHMM,
  validateLecturePlanForm,
  type LecturePlanFormErrors,
} from '@/lib/lecturePlan';
import type { AssignedCourse } from '@/hooks/useAssignments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface LecturePlanFormInitial {
  id: string;
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
}

/**
 * Add / edit one planned lecture in My Lecture Plan.
 *
 * Creating goes through the server-side `create_lecture_plan` RPC,
 * which refuses any course the lecturer is not assigned to.
 * Editing updates the row directly; the RLS update policy only
 * allows the owner's own rows and re-checks course ownership on the
 * new row. The client never decides ownership itself.
 */
export function LecturePlanForm({
  courses,
  initial,
  onSaved,
  onCancel,
}: {
  courses: AssignedCourse[];
  initial?: LecturePlanFormInitial | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [courseId, setCourseId] = useState(initial?.courseId ?? '');
  const [dayOfWeek, setDayOfWeek] = useState(
    initial ? String(initial.dayOfWeek) : '',
  );
  const [startTime, setStartTime] = useState(initial?.startTime ?? '');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '');
  const [room, setRoom] = useState(initial?.room ?? '');
  const [fieldErrors, setFieldErrors] = useState<LecturePlanFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const errors = validateLecturePlanForm({
      courseId,
      dayOfWeek: dayOfWeek === '' ? null : Number(dayOfWeek),
      startTime,
      endTime,
      room,
    });
    if (hasLecturePlanFormErrors(errors)) {
      setFieldErrors(errors);
      return;
    }
    if (!supabase) {
      setError('Supabase is not configured yet.');
      return;
    }
    setLoading(true);
    if (initial) {
      const { error: updateError } = await supabase
        .from('lecture_plans')
        .update({
          course_id: courseId,
          day_of_week: Number(dayOfWeek),
          start_time: startTime,
          end_time: endTime === '' ? null : endTime,
          room: room.trim() === '' ? null : room.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', initial.id);
      setLoading(false);
      if (updateError) {
        if (updateError.code === '23505') {
          setError('This lecture is already in your plan for this day and time.');
        } else if (
          updateError.message.includes('row-level security') ||
          updateError.message.includes('policy')
        ) {
          setError('You are not assigned to this course. Choose one of your courses.');
        } else {
          setError(updateError.message);
        }
        return;
      }
    } else {
      const result = await createLecturePlan(supabase, {
        courseId,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
        room,
      });
      setLoading(false);
      if ('error' in result) {
        setError(result.error);
        return;
      }
    }
    setFieldErrors({});
    onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Course
        <select
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          <option value="">Choose one of your courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} — {course.title} · Level {course.level}
            </option>
          ))}
        </select>
        {fieldErrors.courseId ? (
          <span className="text-[13px] font-normal text-danger" role="alert">
            {fieldErrors.courseId}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Day
        <select
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(e.target.value)}
        >
          <option value="">Choose a day</option>
          {DAY_NAMES.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
        {fieldErrors.dayOfWeek ? (
          <span className="text-[13px] font-normal text-danger" role="alert">
            {fieldErrors.dayOfWeek}
          </span>
        ) : null}
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
          Start time
          <Input
            required
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          {fieldErrors.startTime ? (
            <span className="text-[13px] font-normal text-danger" role="alert">
              {fieldErrors.startTime}
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
          End time (optional)
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          {fieldErrors.endTime ? (
            <span className="text-[13px] font-normal text-danger" role="alert">
              {fieldErrors.endTime}
            </span>
          ) : null}
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Room (optional)
        <Input
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="e.g. LT1"
        />
        {fieldErrors.room ? (
          <span className="text-[13px] font-normal text-danger" role="alert">
            {fieldErrors.room}
          </span>
        ) : null}
      </label>

      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : initial ? 'Save changes' : 'Add to plan'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** The initial form values for editing one saved plan entry. */
export function initialFromPlan(plan: {
  id: string;
  course_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string | null;
  room: string | null;
}): LecturePlanFormInitial {
  return {
    id: plan.id,
    courseId: plan.course_id,
    dayOfWeek: plan.day_of_week,
    startTime: toHHMM(plan.start_time),
    endTime: plan.end_time ? toHHMM(plan.end_time) : '',
    room: plan.room ?? '',
  };
}
