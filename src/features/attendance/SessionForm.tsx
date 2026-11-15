import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { isValidWeekNumber, weekOptions } from '@/lib/attendance';
import { weekForDate } from '@/lib/calendar';
import {
  QR_EXPIRY_OPTIONS,
  hasSessionFormErrors,
  validateSessionForm,
  type SessionFormErrors,
} from '@/lib/sessionForm';
import type { AssignedCourse, AssignedDepartment } from '@/hooks/useAssignments';
import type { LectureRoom } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const QR_EXPIRY_LABELS: Record<number, string> = {
  60: '1 minute (60 seconds)',
  300: '5 minutes (300 seconds)',
  600: '10 minutes (600 seconds)',
  900: '15 minutes (900 seconds)',
};

/**
 * Phase 1 session creation — Draft only. Department and course come
 * from the lecturer's authorized assignments; academic session and
 * semester are derived from the chosen course; lecturer id, timestamp
 * and status='draft' are set by the system, never taken from the form.
 * Week is validated client-side (1–15), cross-checked against the
 * lecture date via the academic calendar, and again by the database
 * CHECK constraint. Multiple sessions per course per week are allowed.
 *
 * Classroom passcode (Phase 2): a secure 6-digit passcode is generated
 * server-side when the session is activated, together with the QR
 * token, and shown once with the QR code. Only the passcode's SHA-256
 * hash is stored. There is no passcode setting on this form — the
 * passcode is issued at activation, not at creation.
 */
export function SessionForm({
  departments,
  courses,
  rooms,
  lecturerId,
  onCreated,
}: {
  departments: AssignedDepartment[];
  courses: AssignedCourse[];
  rooms: LectureRoom[];
  lecturerId: string;
  onCreated: () => void;
}) {
  const [departmentId, setDepartmentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [lectureDate, setLectureDate] = useState('');
  const [weekNumber, setWeekNumber] = useState(1);
  const [headcount, setHeadcount] = useState('');
  const [qrExpiresInSeconds, setQrExpiresInSeconds] = useState(300);
  const [lectureRoomId, setLectureRoomId] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SessionFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const departmentCourses = courses.filter((c) => c.department_id === departmentId);
  const selectedCourse = courses.find((c) => c.id === courseId) ?? null;
  const semester = selectedCourse?.semester ?? null;
  const departmentRooms = rooms.filter((r) => r.department_id === departmentId);
  const derivedWeek = semester && lectureDate ? weekForDate(semester, lectureDate) : null;

  function onDepartmentChange(value: string) {
    setDepartmentId(value);
    setCourseId('');
    setLectureRoomId('');
    setFieldErrors({});
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (!isValidWeekNumber(weekNumber)) {
      setFieldErrors({ weekNumber: 'Week number must be between 1 and 15.' });
      return;
    }
    const errors = validateSessionForm(
      {
        departmentId,
        courseId,
        title,
        lectureDate,
        weekNumber,
        headcount: headcount === '' ? null : Number(headcount),
        qrExpiresInSeconds,
        lectureRoomId: lectureRoomId === '' ? null : lectureRoomId,
      },
      semester,
    );
    if (hasSessionFormErrors(errors)) {
      setFieldErrors(errors);
      return;
    }
    if (!supabase || !selectedCourse) {
      setError('Supabase is not configured yet.');
      return;
    }
    setLoading(true);
    const { error: insertError } = await supabase.from('attendance_sessions').insert({
      course_id: selectedCourse.id,
      lecturer_id: lecturerId,
      semester_id: selectedCourse.semester_id,
      lecture_room_id: lectureRoomId === '' ? null : lectureRoomId,
      title: title.trim(),
      lecture_date: lectureDate,
      week_number: weekNumber,
      headcount: headcount === '' ? null : Number(headcount),
      qr_expires_in_seconds: qrExpiresInSeconds,
      status: 'draft',
    });
    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSuccess(true);
    setFieldErrors({});
    setTitle('');
    setLectureDate('');
    setHeadcount('');
    onCreated();
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Department
        <select
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
          value={departmentId}
          onChange={(e) => onDepartmentChange(e.target.value)}
        >
          <option value="">Choose a department</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
        {fieldErrors.departmentId ? (
          <span className="text-[13px] font-normal text-danger" role="alert">
            {fieldErrors.departmentId}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Course
        <select
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          disabled={departmentId === ''}
        >
          <option value="">Choose a course</option>
          {departmentCourses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} — {course.title}
            </option>
          ))}
        </select>
        {fieldErrors.courseId ? (
          <span className="text-[13px] font-normal text-danger" role="alert">
            {fieldErrors.courseId}
          </span>
        ) : null}
      </label>

      {selectedCourse ? (
        <p className="text-[13px] text-muted">
          {selectedCourse.academicSessionName} · {selectedCourse.semesterName}
          {semester ? ` · ${semester.start_date} to ${semester.end_date}` : ''}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Attendance title / lecture topic
        <Input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Introduction to React Hooks"
        />
        {fieldErrors.title ? (
          <span className="text-[13px] font-normal text-danger" role="alert">
            {fieldErrors.title}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Lecture date
        <Input
          required
          type="date"
          value={lectureDate}
          onChange={(e) => setLectureDate(e.target.value)}
        />
        {derivedWeek !== null ? (
          <span className="text-[13px] font-normal text-muted">
            This date falls in week {derivedWeek} of the semester.
          </span>
        ) : null}
        {fieldErrors.lectureDate ? (
          <span className="text-[13px] font-normal text-danger" role="alert">
            {fieldErrors.lectureDate}
          </span>
        ) : null}
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
        {fieldErrors.weekNumber ? (
          <span className="text-[13px] font-normal text-danger" role="alert">
            {fieldErrors.weekNumber}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Lecture room (optional)
        <select
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
          value={lectureRoomId}
          onChange={(e) => setLectureRoomId(e.target.value)}
          disabled={departmentId === ''}
        >
          <option value="">No room</option>
          {departmentRooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
              {room.building ? ` — ${room.building}` : ''}
            </option>
          ))}
        </select>
        {departmentId !== '' && departmentRooms.length === 0 ? (
          <span className="text-[13px] font-normal text-muted">
            No lecture rooms registered for this department.
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        Expected / physically counted student total
        <Input
          type="number"
          min={0}
          step={1}
          value={headcount}
          onChange={(e) => setHeadcount(e.target.value)}
          placeholder="60"
        />
        {fieldErrors.headcount ? (
          <span className="text-[13px] font-normal text-danger" role="alert">
            {fieldErrors.headcount}
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
        QR code expiry
        <select
          className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
          value={qrExpiresInSeconds}
          onChange={(e) => setQrExpiresInSeconds(Number(e.target.value))}
        >
          {QR_EXPIRY_OPTIONS.map((seconds) => (
            <option key={seconds} value={seconds}>
              {QR_EXPIRY_LABELS[seconds]}
            </option>
          ))}
        </select>
        {fieldErrors.qrExpiresInSeconds ? (
          <span className="text-[13px] font-normal text-danger" role="alert">
            {fieldErrors.qrExpiresInSeconds}
          </span>
        ) : null}
      </label>

      <p className="text-[13px] text-muted">
        When this session is activated, a QR code and a 6-digit classroom passcode are
        generated and shown once. Students scan the code or enter the passcode to submit
        attendance — no student account is needed.
      </p>

      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-[13px] text-success" role="status">
          Session created as a draft.
        </p>
      ) : null}
      <Button type="submit" disabled={loading} className="self-start">
        {loading ? 'Creating…' : 'Create draft session'}
      </Button>
    </form>
  );
}
