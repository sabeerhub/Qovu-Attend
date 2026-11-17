/**
 * "Mark all as arrived" helpers (v0.12.0 — pure, tested).
 *
 * The lecturer counts everyone in the hall and has no time to add
 * students one by one. One tap marks every student on the course's
 * class list as manual attendance. The confirm step shows the
 * numbers first; the server re-derives everything (it never trusts
 * these counts — they are a preview for the lecturer only).
 *
 * The shared reason is fixed, so every record from one bulk mark
 * carries the same reason in the audit log, exactly like a single
 * manual add carries the reason the lecturer typed.
 */

import { normalizeRegistrationNumber } from './submission';
import type { AttendanceRecord, CourseStudent } from '@/types/database';
import type { BulkMarkResponse } from './edgeFunctions';

/** The one shared reason stored on every bulk-marked record. */
export const BULK_MARK_REASON = 'Marked all as arrived by lecturer';

export interface BulkMarkPreview {
  /** Students on the course's class list. */
  onList: number;
  /** On the list and already have a record — these will be skipped. */
  alreadySubmitted: number;
  /** On the list with no record yet — these will be marked. */
  toMark: number;
  /** The session's confirmed headcount, or null when none was recorded. */
  headcount: number | null;
  /**
   * Verified + manual after the mark, against the headcount. Null
   * when there is no headcount to compare against. When true, the
   * session will show the headcount review flag after the mark —
   * the lecturer sees the mismatch coming, before confirming.
   */
  willExceedHeadcount: boolean | null;
}

/**
 * The confirm step's numbers, from the class list and the records
 * already loaded for the session. A number on the list twice is
 * counted once; a record's number is matched on the normalized
 * form. The headcount flag is display-only — it never changes a
 * status and never calls a student a fraud.
 */
export function computeBulkMarkPreview(input: {
  roster: readonly CourseStudent[];
  records: ReadonlyArray<Pick<AttendanceRecord, 'registration_number' | 'status'>>;
  headcount: number | null;
}): BulkMarkPreview {
  const uniqueOnList = new Set<string>();
  for (const student of input.roster) {
    const regNumber = normalizeRegistrationNumber(student.reg_number);
    if (regNumber.length > 0) uniqueOnList.add(regNumber);
  }
  const alreadySubmitted = new Set<string>();
  let verifiedPlusManual = 0;
  for (const record of input.records) {
    if (record.status === 'verified' || record.status === 'manual') {
      verifiedPlusManual += 1;
    }
    alreadySubmitted.add(normalizeRegistrationNumber(record.registration_number));
  }
  let alreadyOnList = 0;
  for (const regNumber of uniqueOnList) {
    if (alreadySubmitted.has(regNumber)) alreadyOnList += 1;
  }
  const toMark = uniqueOnList.size - alreadyOnList;
  const after = verifiedPlusManual + toMark;
  return {
    onList: uniqueOnList.size,
    alreadySubmitted: alreadyOnList,
    toMark,
    headcount: input.headcount,
    willExceedHeadcount:
      input.headcount === null ? null : after > input.headcount,
  };
}

/**
 * The plain-language outcome after a bulk mark, from the server's
 * counts. Never a silent half-result: a partial failure says how
 * many were marked and how many failed.
 */
export function bulkMarkResultMessage(result: BulkMarkResponse): string {
  const parts: string[] = [];
  if (result.marked > 0) {
    parts.push(
      `Marked ${result.marked} student${result.marked === 1 ? '' : 's'} as arrived.`,
    );
  } else {
    parts.push('Nobody new was marked.');
  }
  if (result.skipped > 0) {
    parts.push(
      `${result.skipped} already submitted, so ${result.skipped === 1 ? 'that student was' : 'they were'} skipped.`,
    );
  }
  if (result.failed > 0) {
    const numbers =
      result.failedNumbers.length > 0 ? `: ${result.failedNumbers.join(', ')}` : '';
    parts.push(
      `${result.failed} could not be marked${numbers}. Try again, or add them by hand.`,
    );
  }
  return parts.join(' ');
}
