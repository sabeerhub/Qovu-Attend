import { describe, expect, it } from 'vitest';
import { isValidSignup, validateSignup, type SignupInput } from '@/lib/signupValidation';
import { buildLecturerProfileRow } from '@/features/authentication/lecturerProfile';
import type { User } from '@supabase/supabase-js';

const valid: SignupInput = {
  fullName: 'Mustapha Abdulsalam Sabeer',
  email: 'lecturer@university.edu',
  password: 'Qovu2026',
  confirmPassword: 'Qovu2026',
};

describe('validateSignup — lecturer sign-up validation (v0.7.0)', () => {
  it('accepts a complete, valid form', () => {
    expect(validateSignup(valid)).toEqual({});
    expect(isValidSignup(valid)).toBe(true);
  });

  it('rejects a missing or one-letter name', () => {
    expect(validateSignup({ ...valid, fullName: ' ' }).fullName).toBeTruthy();
    expect(validateSignup({ ...valid, fullName: 'A' }).fullName).toBeTruthy();
  });

  it('rejects a malformed email', () => {
    expect(validateSignup({ ...valid, email: 'not-an-email' }).email).toBeTruthy();
    expect(validateSignup({ ...valid, email: 'a@b' }).email).toBeTruthy();
  });

  it('rejects a short password and one without a letter or a number', () => {
    expect(validateSignup({ ...valid, password: 'Qov202', confirmPassword: 'Qov202' }).password).toBeTruthy();
    expect(validateSignup({ ...valid, password: 'abcdefgh', confirmPassword: 'abcdefgh' }).password).toBeTruthy();
    expect(validateSignup({ ...valid, password: '12345678', confirmPassword: '12345678' }).password).toBeTruthy();
  });

  it('rejects mismatched passwords', () => {
    const errors = validateSignup({ ...valid, confirmPassword: 'Qovu2027' });
    expect(errors.confirmPassword).toBeTruthy();
    expect(isValidSignup({ ...valid, confirmPassword: 'Qovu2027' })).toBe(false);
  });

  it('reports several bad fields at once', () => {
    const errors = validateSignup({
      fullName: '',
      email: 'bad',
      password: 'short',
      confirmPassword: 'different',
    });
    expect(Object.keys(errors).sort()).toEqual([
      'confirmPassword',
      'email',
      'fullName',
      'password',
    ]);
  });
});

describe('buildLecturerProfileRow — profile row for a new user (v0.7.0)', () => {
  function user(overrides: Partial<User> = {}): User {
    return {
      id: 'user-1',
      email: 'lecturer@university.edu',
      user_metadata: { full_name: 'Mustapha Abdulsalam Sabeer' },
      ...overrides,
    } as unknown as User;
  }

  it('builds the row from the auth user — own id only, never another user', () => {
    expect(buildLecturerProfileRow(user())).toEqual({
      user_id: 'user-1',
      full_name: 'Mustapha Abdulsalam Sabeer',
      email: 'lecturer@university.edu',
    });
  });

  it('returns null when the account has no name or no email — never invents one', () => {
    expect(buildLecturerProfileRow(user({ user_metadata: {} }))).toBeNull();
    expect(buildLecturerProfileRow(user({ email: undefined }))).toBeNull();
  });
});
