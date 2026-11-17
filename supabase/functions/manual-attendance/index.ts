// manual-attendance — lecturer manual entry + correction (Phase 2).
//
// POST { sessionId, registrationNumber, reason }                       -> manual add
// POST { sessionId, recordId, newStatus, reason }                     -> correction
// POST { sessionId, recordId, faceReview: 'confirm' | 'dismiss', reason } -> face review (v0.10.0)
// POST { sessionId, bulkMarkAll: true, reason }                      -> mark all as arrived (v0.12.0)
// Exactly one of the four shapes is accepted per call.
// Requires the lecturer's Supabase Auth JWT; the caller must own the
// session. Finalized / archived sessions are read-only: all shapes
// are refused with 409 session_read_only.
//
// Server-side rules:
//   - Registration number normalised (trim + uppercase); reason is
//     required and must be non-blank for all shapes.
//   - Manual add: inserts a record with status 'manual',
//     verification_method 'manual', manual_reason = reason. The DB
//     unique constraint on (session_id, registration_number) rejects
//     a student who already submitted (409 duplicate_registration).
//   - Correction: updates the record's status to newStatus (one of
//     verified / manual / pending / rejected / suspicious). The
//     client never gets to rewrite a finalized record silently.
//   - Face review (v0.10.0): clears the `face_review` flag on a
//     record. 'confirm' means the lecturer agrees the same face was
//     used for two numbers — the record becomes 'suspicious'.
//     'dismiss' means the lecturer checked and it is fine — the
//     status stays as it was. A record that is not flagged is
//     refused (409 face_review_not_flagged). See faceReview.ts.
//   - Bulk mark all as arrived (v0.12.0): marks every student on
//     the course's class list as manual attendance, skipping any
//     registration number that already has a record in this
//     session — nobody is ever counted twice, and a second run
//     marks nobody new. The class list is re-read server-side;
//     the client never decides who gets marked. One shared reason
//     is stored on every new record and in the audit log (one
//     audit row per marked record, action
//     'bulk_manual_attendance'). A course with no class list is
//     refused (409 empty_class_list). See bulkMark.ts.
//   - Every manual entry, correction, face review and bulk mark
//     writes an attendance_audit_logs row (action
//     'manual_attendance', 'correction', 'face_review_confirmed',
//     'face_review_dismissed' or 'bulk_manual_attendance',
//     previous/new status, reason, lecturer, timestamp).
//
// UNTESTED: this function has not been run against a live Supabase
// project. Deploy to staging first and exercise manual add,
// correction, duplicate, missing-reason and finalized-session paths
// before pilot. See docs/API_CONTRACTS.md.

import {
  corsHeaders,
  createServiceClient,
  errorResponse,
  getCallerLecturerId,
  jsonResponse,
  normalizeRegistrationNumber,
} from '../_shared/server.ts';
import {
  applyFaceReviewDecision,
  parseFaceReviewDecision,
} from './faceReview.ts';
import {
  buildBulkMarkAuditRows,
  buildBulkMarkRecords,
  computeBulkMarkTargets,
  summarizeBulkMarkRun,
} from './bulkMark.ts';

const RECORD_STATUSES = ['verified', 'manual', 'pending', 'rejected', 'suspicious'] as const;
type RecordStatus = (typeof RECORD_STATUSES)[number];

type ManualBody = {
  sessionId?: unknown;
  registrationNumber?: unknown;
  recordId?: unknown;
  newStatus?: unknown;
  /** Face review decision (v0.10.0): 'confirm' | 'dismiss'. */
  faceReview?: unknown;
  /** Bulk mark all as arrived (v0.12.0): true for the bulk shape. */
  bulkMarkAll?: unknown;
  reason?: unknown;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return errorResponse('method_not_allowed', 'Use POST.', 405);
  }

  let body: ManualBody;
  try {
    body = (await req.json()) as ManualBody;
  } catch {
    return errorResponse('invalid_body', 'Request body must be valid JSON.', 400);
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const registrationNumber = typeof body.registrationNumber === 'string'
    ? normalizeRegistrationNumber(body.registrationNumber)
    : '';
  const recordId = typeof body.recordId === 'string' ? body.recordId.trim() : '';
  const newStatus = typeof body.newStatus === 'string' ? body.newStatus.trim() : '';
  const faceReviewRaw = typeof body.faceReview === 'string' ? body.faceReview.trim() : '';
  const isBulkMark = body.bulkMarkAll === true;

  if (!sessionId) return errorResponse('invalid_request', 'sessionId is required.', 400);
  if (!reason) return errorResponse('invalid_request', 'A reason is required for every manual entry and correction.', 400);
  const isAdd = Boolean(registrationNumber);
  const isCorrection = Boolean(recordId) && Boolean(newStatus);
  const isFaceReview = Boolean(recordId) && faceReviewRaw.length > 0;
  if ([isAdd, isCorrection, isFaceReview, isBulkMark].filter(Boolean).length !== 1) {
    return errorResponse(
      'invalid_request',
      'Send either registrationNumber (manual add), recordId + newStatus (correction), recordId + faceReview (face review), or bulkMarkAll (mark all as arrived), not more than one.',
      400,
    );
  }
  if (isCorrection && !(RECORD_STATUSES as readonly string[]).includes(newStatus)) {
    return errorResponse('invalid_request', 'newStatus must be a valid attendance status.', 400);
  }
  const faceReviewDecision = isFaceReview ? parseFaceReviewDecision(faceReviewRaw) : null;
  if (isFaceReview && !faceReviewDecision) {
    return errorResponse('invalid_request', "faceReview must be 'confirm' or 'dismiss'.", 400);
  }

  const lecturerId = await getCallerLecturerId(req);
  if (!lecturerId) {
    return errorResponse('unauthorized', 'Sign in as a lecturer to change attendance.', 401);
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (err) {
    return errorResponse('not_configured', err instanceof Error ? err.message : 'Function not configured.', 500);
  }

  const { data: session, error: sessionError } = await supabase
    .from('attendance_sessions')
    .select('id, lecturer_id, course_id, status')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError) return errorResponse('server_error', sessionError.message, 500);
  if (!session) return errorResponse('session_not_found', 'No such attendance session.', 404);
  if (session.lecturer_id !== lecturerId) {
    return errorResponse('forbidden', 'This session does not belong to you.', 403);
  }
  if (session.status === 'finalized' || session.status === 'archived') {
    return errorResponse(
      'session_read_only',
      'This session is finalized and read-only. Corrections require an authorized action outside the normal flow.',
      409,
    );
  }

  // Face review (v0.10.0): confirm or dismiss a `face_review`
  // flag. Confirm means the lecturer agrees the same face was used
  // for two numbers — the record becomes 'suspicious'. Dismiss
  // means the lecturer checked and it is fine — the status stays.
  // Either way the flag is cleared and the decision is audited.
  if (isFaceReview && faceReviewDecision) {
    const { data: flagged, error: flaggedError } = await supabase
      .from('attendance_records')
      .select('id, session_id, status, face_review')
      .eq('id', recordId)
      .eq('session_id', sessionId)
      .maybeSingle();
    if (flaggedError) return errorResponse('server_error', flaggedError.message, 500);
    if (!flagged) return errorResponse('record_not_found', 'No such attendance record in this session.', 404);
    if (!flagged.face_review) {
      return errorResponse(
        'face_review_not_flagged',
        'This record is not flagged for face review.',
        409,
      );
    }
    const previousStatus = flagged.status as RecordStatus;
    const outcome = applyFaceReviewDecision(faceReviewDecision, previousStatus);
    const { data: record, error: updateError } = await supabase
      .from('attendance_records')
      .update(outcome.update)
      .eq('id', recordId)
      .select('id, session_id, registration_number, status, verification_method, manual_reason, submitted_at, selfie_path, selfie_hash, face_review')
      .single();
    if (updateError || !record) {
      return errorResponse('server_error', updateError?.message ?? 'Could not update the record.', 500);
    }
    const { error: auditError } = await supabase.from('attendance_audit_logs').insert({
      session_id: sessionId,
      record_id: recordId,
      lecturer_id: lecturerId,
      action: outcome.auditAction,
      previous_status: previousStatus,
      new_status: outcome.newStatus,
      reason,
    });
    if (auditError) {
      return jsonResponse({
        ok: true,
        warning: 'Face review saved, but the audit log entry could not be written: ' + auditError.message,
        record,
      });
    }
    return jsonResponse({ ok: true, record });
  }

  // Bulk mark all as arrived (v0.12.0): one tap marks every
  // student on the course's class list as manual attendance. The
  // list and the session's records are re-read server-side — the
  // client never decides who gets marked. Anyone who already has
  // a record (verified or manual) is skipped, so nobody is ever
  // counted twice and a second run marks nobody new. A course
  // with no class list has nobody to mark, so it is refused.
  if (isBulkMark) {
    const { data: rosterRows, error: rosterError } = await supabase
      .from('course_students')
      .select('reg_number')
      .eq('course_id', session.course_id);
    if (rosterError) return errorResponse('server_error', rosterError.message, 500);
    const roster = (rosterRows ?? []).map((row) => row.reg_number as string);
    if (roster.length === 0) {
      return errorResponse(
        'empty_class_list',
        'This course has no class list yet. Add students to the class list first.',
        409,
      );
    }
    const { data: existingRows, error: existingError } = await supabase
      .from('attendance_records')
      .select('registration_number')
      .eq('session_id', sessionId);
    if (existingError) return errorResponse('server_error', existingError.message, 500);
    const targets = computeBulkMarkTargets(
      roster,
      (existingRows ?? []).map((row) => row.registration_number as string),
    );
    if (targets.toMark.length === 0) {
      return jsonResponse({
        ok: true,
        marked: 0,
        skipped: targets.skipped.length,
        failed: 0,
        failedNumbers: [],
      });
    }
    const rows = buildBulkMarkRecords(sessionId, targets.toMark, reason);
    const { data: inserted, error: insertError } = await supabase
      .from('attendance_records')
      .insert(rows)
      .select('id, registration_number');
    let markedRecords: Array<{ id: string; registration_number: string }>;
    let failedNumbers: string[] = [];
    if (!insertError && inserted) {
      markedRecords = inserted as Array<{ id: string; registration_number: string }>;
    } else if ((insertError as { code?: string }).code === '23505') {
      // A race: a student submitted between the read and the
      // insert. Retry the remaining numbers one by one — a
      // duplicate is just a skip, a real error is a failure.
      markedRecords = [];
      const outcomes: Array<'marked' | 'skipped' | 'failed'> = [];
      const raceFailedNumbers: string[] = [];
      for (const row of rows) {
        const { data: one, error: oneError } = await supabase
          .from('attendance_records')
          .insert(row)
          .select('id, registration_number')
          .single();
        if (!oneError && one) {
          outcomes.push('marked');
          markedRecords.push(one as { id: string; registration_number: string });
        } else if ((oneError as { code?: string }).code === '23505') {
          outcomes.push('skipped');
        } else {
          outcomes.push('failed');
          raceFailedNumbers.push(row.registration_number);
        }
      }
      const outcome = summarizeBulkMarkRun(outcomes, raceFailedNumbers);
      const totalSkipped = targets.skipped.length + outcome.skipped;
      failedNumbers = outcome.failedNumbers;
      if (outcome.marked === 0 && outcome.failed === 0) {
        // Everything was already submitted mid-run — nothing new
        // to mark, and nothing failed.
        return jsonResponse({
          ok: true,
          marked: 0,
          skipped: totalSkipped,
          failed: 0,
          failedNumbers: [],
        });
      }
      if (outcome.failed > 0 && outcome.marked === 0) {
        // Nothing could be marked at all — a plain failure, not a
        // half-result dressed as success.
        return errorResponse(
          'server_error',
          `Could not mark any students as arrived (${outcome.failed} failed). Try again.`,
          500,
        );
      }
      const auditRows = buildBulkMarkAuditRows(sessionId, markedRecords, lecturerId, reason);
      const { error: auditError } = await supabase
        .from('attendance_audit_logs')
        .insert(auditRows);
      return jsonResponse({
        ok: true,
        marked: outcome.marked,
        skipped: totalSkipped,
        failed: outcome.failed,
        failedNumbers,
        warning: auditError
          ? `Marked ${outcome.marked} students as arrived, but the audit log entries could not be written: ${auditError.message}`
          : undefined,
      });
    } else {
      // The single bulk insert failed outright — the statement is
      // atomic, so nothing was marked. Report it as a failure,
      // never as a partial success.
      return errorResponse('server_error', insertError?.message ?? 'Could not mark students as arrived.', 500);
    }
    const auditRows = buildBulkMarkAuditRows(sessionId, markedRecords, lecturerId, reason);
    const { error: auditError } = await supabase
      .from('attendance_audit_logs')
      .insert(auditRows);
    return jsonResponse({
      ok: true,
      marked: markedRecords.length,
      skipped: targets.skipped.length,
      failed: 0,
      failedNumbers: [],
      warning: auditError
        ? `Marked ${markedRecords.length} students as arrived, but the audit log entries could not be written: ${auditError.message}`
        : undefined,
    });
  }

  if (isAdd) {
    const { data: record, error: insertError } = await supabase
      .from('attendance_records')
      .insert({
        session_id: sessionId,
        registration_number: registrationNumber,
        status: 'manual',
        verification_method: 'manual',
        manual_reason: reason,
      })
      .select('id, session_id, registration_number, status, verification_method, manual_reason, submitted_at, selfie_path, selfie_hash, face_review')
      .single();
    if (insertError) {
      if ((insertError as { code?: string }).code === '23505') {
        return errorResponse(
          'duplicate_registration',
          'That registration number already has a record in this session.',
          409,
        );
      }
      return errorResponse('server_error', insertError.message, 500);
    }
    const { error: auditError } = await supabase.from('attendance_audit_logs').insert({
      session_id: sessionId,
      record_id: record.id,
      lecturer_id: lecturerId,
      action: 'manual_attendance',
      previous_status: null,
      new_status: 'manual',
      reason,
    });
    if (auditError) {
      return jsonResponse({
        ok: true,
        warning: 'Manual entry saved, but the audit log entry could not be written: ' + auditError.message,
        record,
      });
    }
    return jsonResponse({ ok: true, record });
  }

  // Correction.
  const { data: existing, error: existingError } = await supabase
    .from('attendance_records')
    .select('id, session_id, status')
    .eq('id', recordId)
    .eq('session_id', sessionId)
    .maybeSingle();
  if (existingError) return errorResponse('server_error', existingError.message, 500);
  if (!existing) return errorResponse('record_not_found', 'No such attendance record in this session.', 404);

  const previousStatus = existing.status as RecordStatus;
  const { data: record, error: updateError } = await supabase
    .from('attendance_records')
    .update({ status: newStatus })
    .eq('id', recordId)
    .select('id, session_id, registration_number, status, verification_method, manual_reason, submitted_at, selfie_path, selfie_hash, face_review')
    .single();
  if (updateError || !record) {
    return errorResponse('server_error', updateError?.message ?? 'Could not update the record.', 500);
  }
  const { error: auditError } = await supabase.from('attendance_audit_logs').insert({
    session_id: sessionId,
    record_id: recordId,
    lecturer_id: lecturerId,
    action: 'correction',
    previous_status: previousStatus,
    new_status: newStatus,
    reason,
  });
  if (auditError) {
    return jsonResponse({
      ok: true,
      warning: 'Correction saved, but the audit log entry could not be written: ' + auditError.message,
      record,
    });
  }
  return jsonResponse({ ok: true, record });
});
