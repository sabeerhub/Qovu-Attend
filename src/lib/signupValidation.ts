/**
 * Lecturer sign-up validation (v0.7.0) — pure functions, no I/O.
 * Rules, in plain words: a real name, a real email, a password of
 * at least 8 characters with a letter and a number, and both
 * password fields matching. The server (Supabase Auth) still
 * enforces its own rules; this is only the friendly first check.
 */

export interface SignupInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export type SignupField = 'fullName' | 'email' | 'password' | 'confirmPassword';

export type SignupErrors = Partial<Record<SignupField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field-by-field errors; empty object means the form is valid. */
export function validateSignup(input: SignupInput): SignupErrors {
  const errors: SignupErrors = {};

  if (input.fullName.trim().length < 2) {
    errors.fullName = 'Enter your full name.';
  }

  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (input.password.length < 8) {
    errors.password = 'Use at least 8 characters.';
  } else if (!/[A-Za-z]/.test(input.password) || !/[0-9]/.test(input.password)) {
    errors.password = 'Include at least one letter and one number.';
  }

  if (input.confirmPassword !== input.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

/** True when `validateSignup` finds no errors. */
export function isValidSignup(input: SignupInput): boolean {
  return Object.keys(validateSignup(input)).length === 0;
}
