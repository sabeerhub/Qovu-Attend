import { describe, expect, it } from 'vitest';
import { CONTACT_TOPICS, isContactTopic, isValidContact, validateContact } from '@/lib/contactValidation';

const valid = {
  name: 'Mustapha Abdulsalam Sabeer',
  email: 'lecturer@university.edu',
  topic: 'problem' as const,
  message: 'The QR code did not open on my phone.',
};

describe('validateContact — contact form validation (v0.8.2)', () => {
  it('accepts a complete, honest report', () => {
    expect(validateContact(valid)).toEqual({});
    expect(isValidContact(valid)).toBe(true);
  });

  it('needs a real name', () => {
    expect(validateContact({ ...valid, name: ' ' }).name).toBe('Enter your name.');
  });

  it('needs a valid email address', () => {
    expect(validateContact({ ...valid, email: 'not-an-email' }).email).toBe('Enter a valid email address.');
  });

  it('rejects a topic the form does not offer', () => {
    expect(
      validateContact({ ...valid, topic: 'something-else' as never }).topic,
    ).toBe('Choose what your message is about.');
  });

  it('needs a message long enough to say something', () => {
    expect(validateContact({ ...valid, message: 'Too short' }).message).toContain('at least 10 characters');
  });
});

describe('contact topics', () => {
  it('offers exactly report a problem, question, feedback', () => {
    expect(CONTACT_TOPICS.map((topic) => topic.label)).toEqual([
      'Report a problem',
      'Question',
      'Feedback',
    ]);
    expect(isContactTopic('problem')).toBe(true);
    expect(isContactTopic('question')).toBe(true);
    expect(isContactTopic('feedback')).toBe(true);
    expect(isContactTopic('other')).toBe(false);
  });
});
