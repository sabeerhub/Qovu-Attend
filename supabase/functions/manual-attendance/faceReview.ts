// Face-review decision for manual-attendance (v0.10.0).
//
// A face flag is always review-only: it never rejects a submission
// and never changes a status on its own. The lecturer clears it
// from the session workspace, one of two ways:
//
//   - confirm: "yes, this is a problem — the same face was used
//     for two numbers." The record becomes `suspicious` (the
//     existing review status — the lecturer can still correct it
//     later) and the flag is cleared, because the review is done.
//   - dismiss: "checked, it is fine" (twins, family, a hash
//     collision, a bad photo). The flag is cleared and the status
//     stays exactly as it was.
//
// Both decisions are audit-logged with a reason, like every other
// manual change. A finalized or archived session stays read-only:
// the function refuses the review there, exactly as it refuses
// corrections.
//
// This module has no imports on purpose: it is the one piece of
// Edge Function logic that can be unit-tested under vitest (Deno
// is not installed in this workspace). The caller passes the
// record's current status; the function only computes the update.

export type FaceReviewDecision = 'confirm' | 'dismiss';

/** The decision must be exactly 'confirm' or 'dismiss'. */
export function parseFaceReviewDecision(value: unknown): FaceReviewDecision | null {
  return value === 'confirm' || value === 'dismiss' ? value : null;
}

export interface FaceReviewOutcome {
  /** Columns to write on the record. */
  update: { face_review: false; status?: string };
  /** Status after the decision (for the audit row). */
  newStatus: string;
  /** Audit-log action. */
  auditAction: 'face_review_confirmed' | 'face_review_dismissed';
}

/**
 * What a review decision does to a record. The status only ever
 * changes on confirm (to `suspicious`); dismiss leaves it alone.
 * The flag is always cleared — a reviewed flag is done, either way.
 */
export function applyFaceReviewDecision(
  decision: FaceReviewDecision,
  previousStatus: string,
): FaceReviewOutcome {
  if (decision === 'confirm') {
    return {
      update: { face_review: false, status: 'suspicious' },
      newStatus: 'suspicious',
      auditAction: 'face_review_confirmed',
    };
  }
  return {
    update: { face_review: false },
    newStatus: previousStatus,
    auditAction: 'face_review_dismissed',
  };
}
