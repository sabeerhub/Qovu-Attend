import { describe, expect, it } from 'vitest';
import { attemptReasonText } from '@/lib/attempts';

/**
 * Plain words for a refused-try reason (v0.16.0). The lecturer
 * sees these in the session monitor's "Refused tries" section —
 * what happened, nothing more. Never a verdict.
 */
describe('attemptReasonText', () => {
  it('says every logged reason in plain words', () => {
    expect(attemptReasonText('already_submitted')).toBe('Already submitted');
    expect(attemptReasonText('device_already_used')).toBe(
      'This device already submitted in this session',
    );
    expect(attemptReasonText('device_registered_to_other')).toBe(
      'This device is registered to another student',
    );
    expect(attemptReasonText('outside_hall')).toBe('Outside the hall');
    expect(attemptReasonText('location_imprecise')).toBe('Location too imprecise');
    expect(attemptReasonText('not_on_class_list')).toBe('Not on this course’s list');
    expect(attemptReasonText('selfie_missing')).toBe('No selfie sent');
  });

  it('falls back to plain words for an unknown reason', () => {
    expect(attemptReasonText('something_new')).toBe('Refused try');
  });
});
