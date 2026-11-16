export type SessionStatus = 'draft' | 'active' | 'closed' | 'finalized' | 'archived';

export type AttendanceRecordStatus =
  | 'verified'
  | 'manual'
  | 'pending'
  | 'rejected'
  | 'suspicious';

export interface University {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface Faculty {
  id: string;
  university_id: string;
  name: string;
  created_at: string;
}

export interface Department {
  id: string;
  faculty_id: string;
  name: string;
  code: string | null;
  created_at: string;
}

export interface LecturerProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  staff_id: string | null;
  created_at: string;
}

export interface LecturerAssignment {
  id: string;
  lecturer_id: string;
  department_id: string;
  course_id: string | null;
  role: 'lecturer' | 'admin';
  created_at: string;
}

export interface AcademicSession {
  id: string;
  university_id: string;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface Semester {
  id: string;
  academic_session_id: string;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface Course {
  id: string;
  department_id: string;
  semester_id: string;
  code: string;
  title: string;
  level: number;
  credit_unit: number | null;
  created_at: string;
}

export interface LectureRoom {
  id: string;
  department_id: string | null;
  name: string;
  building: string | null;
  capacity: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface AttendanceSession {
  id: string;
  course_id: string;
  lecturer_id: string;
  semester_id: string;
  lecture_room_id: string | null;
  title: string;
  lecture_date: string;
  /** Lecture start time (HH:MM), set by the lecturer. Null on sessions created before v0.4.1. */
  start_time: string | null;
  week_number: number;
  headcount: number | null;
  qr_expires_in_seconds: number;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  /** SHA-256 hash of the live QR token, or null before first activation. Never the token itself. */
  qr_token_hash: string | null;
  /** When the live QR token was issued (server-side expiry = this + qr_expires_in_seconds). */
  qr_token_issued_at: string | null;
  /** SHA-256 hash of the classroom passcode, or null before first activation. */
  passcode_hash: string | null;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  registration_number: string;
  student_name: string | null;
  status: AttendanceRecordStatus;
  verification_method: string | null;
  manual_reason: string | null;
  /** Stable per-(session, student) key; a retried submission returns the original record. */
  idempotency_key: string | null;
  submitted_at: string;
}

export interface AttendanceAuditLog {
  id: string;
  session_id: string | null;
  record_id: string | null;
  lecturer_id: string | null;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  reason: string | null;
  created_at: string;
}
