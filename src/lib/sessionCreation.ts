/**
 * Shared draft-session creation (used by the session form and by
 * My Lecture Plan's "Start session").
 *
 * One insert, one place: a Draft attendance session for a course the
 * lecturer is assigned to. The caller validates the fields first
 * (SessionForm's validateSessionForm, or the plan's
 * sessionInputForPlanEntry, which only ever produces valid values);
 * the database CHECK (week 1–15, headcount >= 0) and the RLS insert
 * policy (own lecturer_id, status 'draft', assigned course) are the
 * server-side backstop. Lecturer id, timestamp and status='draft'
 * are set by the system, never taken from a form.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AttendanceSession } from '@/types/database';

/** A created draft session with its course code, as the session list shows it. */
export interface CreatedDraftSession extends AttendanceSession {
  courses: { code: string } | null;
}

/**
 * The columns a created session is read back with — the same set
 * the session list reads, so a created session opens straight into
 * the monitor without a second query.
 */
export const DRAFT_SESSION_SELECT =
  'id, course_id, lecturer_id, semester_id, lecture_room_id, title, lecture_date, start_time, week_number, headcount, qr_expires_in_seconds, status, created_at, updated_at, anchor_latitude, anchor_longitude, anchor_accuracy_meters, anchor_captured_at, location_radius_meters, courses(code)';

export interface CreateDraftSessionInput {
  courseId: string;
  lecturerId: string;
  semesterId: string;
  lectureRoomId: string | null;
  title: string;
  lectureDate: string;
  startTime: string;
  weekNumber: number;
  headcount: number | null;
  qrExpiresInSeconds: number;
}

/**
 * Insert one Draft attendance session and return it with its course
 * code, or a plain-language error string on failure. `client` is
 * the configured Supabase client.
 */
export async function createDraftSession(
  client: Pick<SupabaseClient, 'from'>,
  input: CreateDraftSessionInput,
): Promise<{ session: CreatedDraftSession } | { error: string }> {
  const { data, error } = await client
    .from('attendance_sessions')
    .insert({
      course_id: input.courseId,
      lecturer_id: input.lecturerId,
      semester_id: input.semesterId,
      lecture_room_id: input.lectureRoomId,
      title: input.title.trim(),
      lecture_date: input.lectureDate,
      start_time: input.startTime,
      week_number: input.weekNumber,
      headcount: input.headcount,
      qr_expires_in_seconds: input.qrExpiresInSeconds,
      status: 'draft',
    })
    .select(DRAFT_SESSION_SELECT)
    .single();
  if (error) {
    return { error: error.message };
  }
  if (!data) {
    return { error: 'The session could not be created. Try again.' };
  }
  return { session: data as unknown as CreatedDraftSession };
}
