import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { isValidWeekNumber, weekOptions } from '@/lib/attendance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface SessionFormValues {
  courseId: string;
  semesterId: string;
  title: string;
  lectureDate: string;
  weekNumber: number;
  headcount: number | null;
}

/**
 * Phase 1 session creation — Draft only. The lecturer id and status
 * are set by the system, never taken from the form. Week is validated
 * client-side (1–15) and again by the database CHECK constraint.
 * QR / activation is Phase 2 and is deliberately not built here.
 */
export function SessionForm({
  courseId,
  semesterId,
  lecturerId,
  onCreated,
}: {
  courseId: string;
  semesterId: string;
  lecturerId: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [lectureDate, setLectureDate] = useState('');
  const [weekNumber, setWeekNumber] = useState(1);
  const [headcount, setHeadcount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (!isValidWeekNumber(weekNumber)) {
      setError('Week number must be between 1 and 15.');
      return;
    }
    if (!supabase) {
      setError('Supabase is not configured yet.');
      return;
    }
    setLoading(true);
    const { error: insertError } = await supabase.from('attendance_sessions').insert({
      course_id: courseId,
      lecturer_id: lecturerId,
      semester_id: semesterId,
      title,
      lecture_date: lectureDate,
      week_number: weekNumber,
      headcount: headcount === '' ? null : Number(headcount),
      status: 'draft',
    });
    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSuccess(true);
    onCreated();
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Attendance title / lecture topic
        <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Introduction to React Hooks" />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Lecture date
        <Input required type="date" value={lectureDate} onChange={(e) => setLectureDate(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Week number
        <select
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
          value={weekNumber}
          onChange={(e) => setWeekNumber(Number(e.target.value))}
        >
          {weekOptions().map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Expected / physically counted student total
        <Input
          type="number"
          min={0}
          value={headcount}
          onChange={(e) => setHeadcount(e.target.value)}
          placeholder="60"
        />
      </label>
      {error ? <p className="text-[13px] text-danger" role="alert">{error}</p> : null}
      {success ? <p className="text-[13px] text-success" role="status">Session created as a draft.</p> : null}
      <Button type="submit" disabled={loading} className="self-start">
        {loading ? 'Creating…' : 'Create draft session'}
      </Button>
    </form>
  );
}
