// manual-attendance — lecturer manual entry + correction (Phase 2).
//
// POST { sessionId, registrationNumber, reason }                       -> manual add
// POST { sessionId, recordId, newStatus, reason }                     -> correction
// POST { sessionId, recordId, faceReview: 'confirm' | 'dismiss', reason } -> face review (v0.10.0)
// Exactly one of the three shapes is accepted per call.
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
//   - Every manual entry, correction and face review writes an
//     attendance_audit_logs row (action 'manual_attendance',
//     'correction', 'face_review_confirmed' or
//     'face_review_dismissed', previous/new status, reason,
//     lecturer, timestamp).
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

const RECORD_STATUSES = ['verified', 'manual', 'pending', 'rejected', 'suspicious'] as const;
type RecordStatus = (typeof RECORD_STATUSES)[number];

type ManualBody = {
  sessionId?: unknown;
  registrationNumber?: unknown;
  recordId?: unknown;
  newStatus?: unknown;
  /** Face review decision (v0.10.0): 'confirm' | 'dismiss'. */
  faceReview?: unknown;
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

  if (!sessionId) return errorResponse('invalid_request', 'sessionId is required.', 400);
  if (!reason) return errorResponse('invalid_request', 'A reason is required for every manual entry and correction.', 400);
  const isAdd = Boolean(registrationNumber);
  const isCorrection = Boolean(recordId) && Boolean(newStatus);
  const isFaceReview = Boolean(recordId) && faceReviewRaw.length > 0;
  if ([isAdd, isCorrection, isFaceReview].filter(Boolean).length !== 1) {
    return errorResponse(
      'invalid_request',
      'Send either registrationNumber (manual add), recordId + newStatus (correction), or recordId + faceReview (face review), not more than one.',
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
    .select('id, lecturer_id, status')
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
