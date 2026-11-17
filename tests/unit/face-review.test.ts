import { describe, expect, it } from 'vitest';
import {
  applyFaceReviewDecision,
  parseFaceReviewDecision,
} from '../../supabase/functions/manual-attendance/faceReview';

describe('parseFaceReviewDecision', () => {
  it('accepts confirm and dismiss only', () => {
    expect(parseFaceReviewDecision('confirm')).toBe('confirm');
    expect(parseFaceReviewDecision('dismiss')).toBe('dismiss');
    expect(parseFaceReviewDecision('Confirm')).toBe(null);
    expect(parseFaceReviewDecision('reject')).toBe(null);
    expect(parseFaceReviewDecision('')).toBe(null);
    expect(parseFaceReviewDecision(null)).toBe(null);
    expect(parseFaceReviewDecision(undefined)).toBe(null);
  });
});

describe('applyFaceReviewDecision', () => {
  it('confirm marks the record suspicious and clears the flag', () => {
    expect(applyFaceReviewDecision('confirm', 'verified')).toEqual({
      update: { face_review: false, status: 'suspicious' },
      newStatus: 'suspicious',
      auditAction: 'face_review_confirmed',
    });
  });

  it('dismiss clears the flag and leaves the status exactly as it was', () => {
    expect(applyFaceReviewDecision('dismiss', 'verified')).toEqual({
      update: { face_review: false },
      newStatus: 'verified',
      auditAction: 'face_review_dismissed',
    });
    expect(applyFaceReviewDecision('dismiss', 'manual')).toEqual({
      update: { face_review: false },
      newStatus: 'manual',
      auditAction: 'face_review_dismissed',
    });
  });
});
