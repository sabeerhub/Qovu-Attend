import { describe, expect, it } from 'vitest';
import {
  buildIdempotencyKey,
  headcountDifference,
  isDuplicateRegistration,
  isValidRegistrationNumber,
  normalizeRegistrationNumber,
  parseHeadcountInput,
  summarizeRecords,
  validateCorrection,
  validateManualAttendance,
} from '@/lib/submission';
import type { AttendanceRecord } from '@/types/database';

function record(reg: string, status: AttendanceRecord['status'] = 'verified'): AttendanceRecord {
  return {
    id: `id-${reg}`,
    session_id: 'session-1',
    registration_number: reg,
    student_name: null,
    status,
    verification_method: 'qr',
    manual_reason: null,
    idempotency_key: null,
    device_fingerprint_hash: null,
    submitted_at: '2026-11-15T10:00:00.000Z',
  };
}

describe('registration number normalisation', () => {
  it('trims and uppercases', () => {
    expect(normalizeRegistrationNumber('  fut/2022/001 ')).toBe('FUT/2022/001');
    expect(normalizeRegistrationNumber('FUT/2022/001')).toBe('FUT/2022/001');
  });

  it('rejects blank registration numbers', () => {
    expect(isValidRegistrationNumber('   ')).toBe(false);
    expect(isValidRegistrationNumber('')).toBe(false);
    expect(isValidRegistrationNumber('FUT/2022/001')).toBe(true);
  });
});

describe('duplicate registration numbers', () => {
  const existing = [record('FUT/2022/001'), record('FUT/2022/002', 'manual')];

  it('detects an exact duplicate', () => {
    expect(isDuplicateRegistration('FUT/2022/001', existing)).toBe(true);
  });

  it('detects a duplicate that differs only by case or whitespace', () => {
    expect(isDuplicateRegistration(' fut/2022/001 ', existing)).toBe(true);
    expect(isDuplicateRegistration('fut/2022/002', existing)).toBe(true);
  });

  it('does not flag a new registration number', () => {
    expect(isDuplicateRegistration('FUT/2022/003', existing)).toBe(false);
  });

  it('does not flag anything in an empty session', () => {
    expect(isDuplicateRegistration('FUT/2022/001', [])).toBe(false);
  });
});

describe('idempotency keys', () => {
  it('is stable for the same session + student across retries', () => {
    const key = buildIdempotencyKey('session-1', 'FUT/2022/001');
    expect(buildIdempotencyKey('session-1', ' fut/2022/001 ')).toBe(key);
  });

  it('differs for a different student or a different session', () => {
    const key = buildIdempotencyKey('session-1', 'FUT/2022/001');
    expect(buildIdempotencyKey('session-1', 'FUT/2022/002')).not.toBe(key);
    expect(buildIdempotencyKey('session-2', 'FUT/2022/001')).not.toBe(key);
  });
});

describe('record summary', () => {
  it('groups records by status', () => {
    const summary = summarizeRecords([
      record('A', 'verified'),
      record('B', 'verified'),
      record('C', 'manual'),
      record('D', 'pending'),
      record('E', 'rejected'),
      record('F', 'suspicious'),
    ]);
    expect(summary).toEqual({
      total: 6,
      verified: 2,
      manual: 1,
      pending: 1,
      rejected: 1,
      suspicious: 1,
    });
  });

  it('is all zeros for an empty session', () => {
    expect(summarizeRecords([])).toEqual({
      total: 0,
      verified: 0,
      manual: 0,
      pending: 0,
      rejected: 0,
      suspicious: 0,
    });
  });
});

describe('headcount difference', () => {
  it('subtracts submissions from headcount', () => {
    expect(headcountDifference(60, 54)).toEqual({ headcount: 60, submissions: 54, difference: 6 });
    expect(headcountDifference(60, 62)).toEqual({ headcount: 60, submissions: 62, difference: -2 });
  });

  it('is null when no headcount was recorded', () => {
    expect(headcountDifference(null, 10).difference).toBeNull();
  });
});

describe('manual attendance validation', () => {
  it('requires a registration number and a reason', () => {
    expect(validateManualAttendance({ registrationNumber: '', reason: 'late arrival' })).toMatch(/registration number/i);
    expect(validateManualAttendance({ registrationNumber: 'FUT/2022/001', reason: '   ' })).toMatch(/reason/i);
    expect(validateManualAttendance({ registrationNumber: 'FUT/2022/001', reason: 'No phone' })).toBeNull();
  });
});

describe('correction validation', () => {
  it('requires a valid status and a reason', () => {
    expect(validateCorrection({ newStatus: 'verified', reason: '' })).toMatch(/reason/i);
    expect(
      validateCorrection({ newStatus: 'bogus' as AttendanceRecord['status'], reason: 'mistake' }),
    ).toMatch(/valid attendance status/i);
    expect(validateCorrection({ newStatus: 'rejected', reason: 'Wrong student' })).toBeNull();
  });
});

describe('headcount confirm at activation', () => {
  it('blank keeps the stored headcount', () => {
    expect(parseHeadcountInput('')).toEqual({ ok: true, value: null });
    expect(parseHeadcountInput('   ')).toEqual({ ok: true, value: null });
  });

  it('accepts whole numbers, including zero', () => {
    expect(parseHeadcountInput('42')).toEqual({ ok: true, value: 42 });
    expect(parseHeadcountInput(' 0 ')).toEqual({ ok: true, value: 0 });
  });

  it('rejects negative, fractional and non-numeric input', () => {
    expect(parseHeadcountInput('-1').ok).toBe(false);
    expect(parseHeadcountInput('3.5').ok).toBe(false);
    expect(parseHeadcountInput('many').ok).toBe(false);
  });
});
