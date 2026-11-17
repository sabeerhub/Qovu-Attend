/**
 * Contact form validation (v0.8.2) — pure functions, no I/O.
 * Rules, in plain words: a real name, a real email, one of the
 * three topics, and a message long enough to say something (at
 * least 10 characters). The database enforces the same length and
 * topic rules server-side; this is only the friendly first check.
 */

export type ContactTopic = 'problem' | 'question' | 'feedback';

export const CONTACT_TOPICS: Array<{ value: ContactTopic; label: string }> = [
  { value: 'problem', label: 'Report a problem' },
  { value: 'question', label: 'Question' },
  { value: 'feedback', label: 'Feedback' },
];

export interface ContactInput {
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
}

export type ContactField = 'name' | 'email' | 'topic' | 'message';

export type ContactErrors = Partial<Record<ContactField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when the topic is one of the three the form offers. */
export function isContactTopic(value: string): value is ContactTopic {
  return CONTACT_TOPICS.some((topic) => topic.value === value);
}

/** Field-by-field errors; empty object means the form is valid. */
export function validateContact(input: ContactInput): ContactErrors {
  const errors: ContactErrors = {};

  if (input.name.trim().length < 2) {
    errors.name = 'Enter your name.';
  }

  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (!isContactTopic(input.topic)) {
    errors.topic = 'Choose what your message is about.';
  }

  if (input.message.trim().length < 10) {
    errors.message = 'Write a little more — at least 10 characters.';
  }

  return errors;
}

/** True when `validateContact` finds no errors. */
export function isValidContact(input: ContactInput): boolean {
  return Object.keys(validateContact(input)).length === 0;
}
