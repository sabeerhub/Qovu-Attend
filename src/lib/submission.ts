/**
 * Student submission helpers (Phase 2, pure, tested).
 *
 * - A registration number is normalised (trim + uppercase) before
 *   anything else happens, so ` fut/2022/001 ` and `FUT/2022/001`
 *   are the same student in a session.
 * - Uniqueness is enforced by the database unique constraint on
 *   (session_id, registration_number); the helpers here mirror that
 *   rule client-side for duplicate detection against an already
 *   loaded record list, and for mapping a server duplicate response.
 * - Idempotency: the key is stable per (session, registration
 *   number), so a retried submission carries the same key and the
 *   server can return the original record instead of creating a
 *   second row. See docs/API_CONTRACTS.md.
 */

import type { AttendanceRecord, AttendanceRecordStatus } from '@/types/database';
import { canTransitionSession, isFinalized } from './attendance';

/** Trim surrounding whitespace and uppercase — the canonical form. */
export function normalizeRegistrationNumber(raw: string): string {
  return raw.trim().toUpperCase();
}

/** A registration number is usable when it has non-blank content after trimming. */
export function isValidRegistrationNumber(raw: string): boolean {
  return normalizeRegistrationNumber(raw).length > 0;
}

/**
 * True when the normalised registration number already appears in
 * the given records for this session (the client-side mirror of the
 * DB unique constraint).
 */
export function isDuplicateRegistration(
  registrationNumber: string,
  records: ReadonlyArray<Pick<AttendanceRecord, 'registration_number'>>,
): boolean {
  const normalized = normalizeRegistrationNumber(registrationNumber);
  if (normalized.length === 0) return false;
  return records.some((r) => normalizeRegistrationNumber(r.registration_number) === normalized);
}

/**
 * Stable idempotency key for one student's submission to one session.
 * The same student retrying the same session sends the same key;
 * a different student (or session) gets a different key.
 */
export function buildIdempotencyKey(sessionId: string, registrationNumber: string): string {
  return `sub-${sessionId}-${normalizeRegistrationNumber(registrationNumber)}`;
}

/**
 * A fresh random idempotency key for one submission attempt, when the
 * caller wants an attempt-scoped key instead of the stable per-student
 * key above. Uses secure randomness, never Math.random.
 */
export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface RecordSummary {
  total: number;
  verified: number;
  manual: number;
  pending: number;
  rejected: number;
  suspicious: number;
}

export const EMPTY_SUMMARY: RecordSummary = {
  total: 0,
  verified: 0,
  manual: 0,
  pending: 0,
  rejected: 0,
  suspicious: 0,
};

/** Group a session's records by status (from real record queries). */
export function summarizeRecords(
  records: ReadonlyArray<Pick<AttendanceRecord, 'status'>>,
): RecordSummary {
  const summary: RecordSummary = { ...EMPTY_SUMMARY };
  for (const record of records) {
    summary.total += 1;
    if (record.status in summary) {
      summary[record.status as keyof Omit<RecordSummary, 'total'>] += 1;
    }
  }
  return summary;
}

export interface HeadcountDifference {
  /** null when the session has no headcount recorded. */
  difference: number | null;
  /** Headcount minus submissions; positive means fewer submissions than counted. */
  submissions: number;
  headcount: number | null;
}

/**
 * Headcount vs. submissions. This is a number to review — a
 * discrepancy is NOT automatic evidence of fraud (spec §8).
 */
export function headcountDifference(
  headcount: number | null,
  submissions: number,
): HeadcountDifference {
  return {
    headcount,
    submissions,
    difference: headcount === null ? null : headcount - submissions,
  };
}

/** Statuses a manual entry may be corrected to (server-enforced too). */
export const CORRECTABLE_STATUSES: readonly AttendanceRecordStatus[] = [
  'verified',
  'manual',
  'pending',
  'rejected',
  'suspicious',
];

export interface ManualAttendanceInput {
  registrationNumber: string;
  reason: string;
}

/** Manual attendance needs both a registration number and a reason. */
export function validateManualAttendance(input: ManualAttendanceInput): string | null {
  if (!isValidRegistrationNumber(input.registrationNumber)) {
    return 'Enter a student registration number.';
  }
  if (input.reason.trim().length === 0) {
    return 'Enter a reason for the manual entry. Every manual entry is recorded in the audit log.';
  }
  return null;
}

export interface CorrectionInput {
  newStatus: AttendanceRecordStatus;
  reason: string;
}

/** A correction needs a valid new status and a reason. */
export function validateCorrection(input: CorrectionInput): string | null {
  if (!CORRECTABLE_STATUSES.includes(input.newStatus)) {
    return 'Choose a valid attendance status.';
  }
  if (input.reason.trim().length === 0) {
    return 'Enter a reason for the correction. Every correction is recorded in the audit log.';
  }
  return null;
}

/**
 * Whether manual attendance / correction controls may be shown for a
 * session. Finalized and archived sessions are read-only; the UI must
 * not render the controls at all for them (not merely disable them).
 */
export function canEditSessionRecords(
  status: Parameters<typeof isFinalized>[0],
): boolean {
  return !isFinalized(status);
}

/** Re-export of the lifecycle guard, for the monitor's action buttons. */
export { canTransitionSession };
