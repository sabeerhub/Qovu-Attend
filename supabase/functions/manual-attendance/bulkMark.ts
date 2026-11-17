// Bulk "mark all as arrived" for manual-attendance (v0.12.0).
//
// The lecturer counts everyone in the hall and has no time to add
// students one by one. One tap marks every student on the course's
// class list as manual attendance — except anyone who already has
// a record in this session (verified or manual), who is skipped, so
// nobody is ever counted twice and a second run marks nobody new.
//
// This module has no imports on purpose: it is the decision logic
// that can be unit-tested under vitest (Deno is not installed in
// this workspace). The Edge Function itself (index.ts) does the
// database calls — it re-reads the class list and the session's
// records server-side, so the client never decides who gets
// marked; the client only shows a preview and sends the tap.

// No imports on purpose: the shared server helper pulls in the
// Supabase client from a remote URL, which vitest cannot resolve,
// so this module inlines the one helper it needs — the same
// trim + uppercase normalization the server helper and the
// database trigger both apply.
function normalizeRegistrationNumber(raw: string): string {
  return raw.trim().toUpperCase();
}

export interface BulkMarkTargets {
  /** Class-list numbers with no record in this session yet. */
  toMark: string[];
  /** Class-list numbers that already have a record — skipped. */
  skipped: string[];
}

/**
 * Who gets marked and who gets skipped. Both sides are normalized
 * (trim + uppercase) before comparing, so `u19/cs/001` and
 * `U19/CS/001` are the same student, and a repeated number on the
 * list is marked once at most.
 */
export function computeBulkMarkTargets(
  roster: readonly string[],
  existingRecords: readonly string[],
): BulkMarkTargets {
  const existing = new Set(existingRecords.map(normalizeRegistrationNumber));
  const toMark: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const raw of roster) {
    const regNumber = normalizeRegistrationNumber(raw);
    if (regNumber.length === 0 || seen.has(regNumber)) continue;
    seen.add(regNumber);
    if (existing.has(regNumber)) skipped.push(regNumber);
    else toMark.push(regNumber);
  }
  return { toMark, skipped };
}

/** One manual-attendance row per number to mark. */
export function buildBulkMarkRecords(
  sessionId: string,
  toMark: readonly string[],
  reason: string,
): Array<{
  session_id: string;
  registration_number: string;
  status: 'manual';
  verification_method: 'manual';
  manual_reason: string;
}> {
  return toMark.map((registration_number) => ({
    session_id: sessionId,
    registration_number,
    status: 'manual',
    verification_method: 'manual',
    manual_reason: reason,
  }));
}

export interface BulkMarkAuditRow {
  session_id: string;
  record_id: string;
  lecturer_id: string;
  action: 'bulk_manual_attendance';
  previous_status: null;
  new_status: 'manual';
  reason: string;
}

/**
 * One audit row per marked record — same per-record trail as a
 * single manual add, so each student's manual entry can be traced
 * to the lecturer, the time, and the shared reason.
 */
export function buildBulkMarkAuditRows(
  sessionId: string,
  markedRecords: ReadonlyArray<{ id: string }>,
  lecturerId: string,
  reason: string,
): BulkMarkAuditRow[] {
  return markedRecords.map((record) => ({
    session_id: sessionId,
    record_id: record.id,
    lecturer_id: lecturerId,
    action: 'bulk_manual_attendance',
    previous_status: null,
    new_status: 'manual',
    reason,
  }));
}

export interface BulkMarkOutcome {
  /** Students newly marked as arrived. */
  marked: number;
  /** Students skipped because they already had a record. */
  skipped: number;
  /** Students that could not be marked (their numbers, for the plain-language report). */
  failed: number;
  failedNumbers: string[];
}

/**
 * The outcome of the per-row fallback (used when the single bulk
 * insert fails on a race — a student submitting between the read
 * and the insert). Each row's result is one of marked, skipped
 * (a duplicate that appeared mid-run), or failed (a real error).
 */
export function summarizeBulkMarkRun(
  results: ReadonlyArray<'marked' | 'skipped' | 'failed'>,
  failedNumbers: readonly string[],
): BulkMarkOutcome {
  let marked = 0;
  let skipped = 0;
  let failed = 0;
  for (const result of results) {
    if (result === 'marked') marked += 1;
    else if (result === 'skipped') skipped += 1;
    else failed += 1;
  }
  return { marked, skipped, failed, failedNumbers: [...failedNumbers] };
}
