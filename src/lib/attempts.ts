import type { AttendanceAttemptReason } from '@/types/database';

/**
 * Plain words for a refused-try reason (v0.16.0). The lecturer
 * sees these in the session monitor's "Refused tries" section.
 * A refused try is a record of what happened, not proof of
 * cheating — so the words say what happened, nothing more.
 */
export function attemptReasonText(reason: AttendanceAttemptReason | string): string {
  switch (reason) {
    case 'already_submitted':
      return 'Already submitted';
    case 'device_already_used':
      return 'This device already submitted in this session';
    case 'device_registered_to_other':
      return 'This device is registered to another student';
    case 'outside_hall':
      return 'Outside the hall';
    case 'location_imprecise':
      return 'Location too imprecise';
    case 'not_on_class_list':
      return 'Not on this course’s list';
    case 'selfie_missing':
      return 'No selfie sent';
    default:
      return 'Refused try';
  }
}
