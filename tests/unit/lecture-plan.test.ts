import { describe, expect, it } from 'vitest';
import {
  dayName,
  dayShortName,
  groupPlansByDay,
  hasLecturePlanFormErrors,
  isValidDayOfWeek,
  mapCreateLecturePlanError,
  nextOccurrence,
  sessionInputForPlanEntry,
  toHHMM,
  validateLecturePlanForm,
  type LecturePlanFormInput,
  type LecturePlanRow,
} from '@/lib/lecturePlan';
import type { AssignedCourse } from '@/hooks/useAssignments';
import type { LecturePlan } from '@/types/database';

// 2026-11-17 is a Tuesday; 2026-11-15 is the Sunday before it.
const TUESDAY = new Date(2026, 10, 17, 9, 0, 0);
const SUNDAY = new Date(2026, 10, 15, 9, 0, 0);

const validInput: LecturePlanFormInput = {
  courseId: 'course-1',
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '10:00',
  room: 'LT1',
};

function makePlan(overrides: Partial<LecturePlan> & { id: string }): LecturePlanRow {
  const base: LecturePlan = {
    id: overrides.id,
    lecturer_id: 'lecturer-1',
    course_id: 'course-1',
    day_of_week: 1,
    start_time: '08:00:00',
    end_time: null,
    room: null,
    created_at: '2026-11-17T00:00:00Z',
    updated_at: '2026-11-17T00:00:00Z',
  };
  return {
    ...base,
    ...overrides,
    course: {
      id: 'course-1',
      code: 'CIT 301',
      title: 'Web Technology',
      level: 200,
      departmentName: 'Information Technology',
    },
  };
}

function makeCourse(semester: AssignedCourse['semester']): AssignedCourse {
  return {
    id: 'course-1',
    department_id: 'dept-1',
    semester_id: 'semester-1',
    code: 'CIT 301',
    title: 'Web Technology',
    level: 200,
    credit_unit: 3,
    created_at: '2026-11-17T00:00:00Z',
    departmentName: 'Information Technology',
    semesterName: 'First Semester',
    academicSessionName: '2026/2027',
    semester,
  };
}

describe('lecture plan weekdays', () => {
  it('accepts Monday to Saturday only', () => {
    for (const day of [1, 2, 3, 4, 5, 6]) expect(isValidDayOfWeek(day)).toBe(true);
    for (const day of [0, 7, -1, 1.5, '1', null, undefined]) {
      expect(isValidDayOfWeek(day)).toBe(false);
    }
  });

  it('names the weekdays', () => {
    expect(dayName(1)).toBe('Monday');
    expect(dayName(6)).toBe('Saturday');
    expect(dayName(7)).toBe('');
    expect(dayShortName(3)).toBe('Wed');
  });
});

describe('toHHMM', () => {
  it('strips seconds from a Postgres time', () => {
    expect(toHHMM('08:00:00')).toBe('08:00');
    expect(toHHMM('08:00')).toBe('08:00');
    expect(toHHMM('23:59:59')).toBe('23:59');
  });

  it('rejects anything that is not a time', () => {
    expect(toHHMM('8:00')).toBe('');
    expect(toHHMM('25:00:00')).toBe('');
    expect(toHHMM('')).toBe('');
  });
});

describe('nextOccurrence', () => {
  it('returns today when the weekday is today', () => {
    expect(nextOccurrence(2, TUESDAY)).toBe('2026-11-17');
  });

  it('returns the next day for a later weekday', () => {
    expect(nextOccurrence(3, TUESDAY)).toBe('2026-11-18');
    expect(nextOccurrence(6, TUESDAY)).toBe('2026-11-21');
  });

  it('returns next week for a weekday already past', () => {
    expect(nextOccurrence(1, TUESDAY)).toBe('2026-11-23');
  });

  it('counts Monday as tomorrow from a Sunday', () => {
    expect(nextOccurrence(1, SUNDAY)).toBe('2026-11-16');
    expect(nextOccurrence(6, SUNDAY)).toBe('2026-11-21');
  });

  it('never returns a past date', () => {
    for (const day of [1, 2, 3, 4, 5, 6]) {
      expect(nextOccurrence(day, TUESDAY) >= '2026-11-17').toBe(true);
    }
  });
});

describe('validateLecturePlanForm', () => {
  it('accepts a complete entry and one with no end time or room', () => {
    expect(validateLecturePlanForm(validInput)).toEqual({});
    expect(
      validateLecturePlanForm({ ...validInput, endTime: '', room: '' }),
    ).toEqual({});
  });

  it('requires a course, a weekday and a start time', () => {
    const errors = validateLecturePlanForm({
      courseId: '',
      dayOfWeek: null,
      startTime: '',
      endTime: '',
      room: '',
    });
    expect(errors.courseId).toBe('Choose a course.');
    expect(errors.dayOfWeek).toBe('Choose a day from Monday to Saturday.');
    expect(errors.startTime).toBe('Choose a lecture start time.');
    expect(hasLecturePlanFormErrors(errors)).toBe(true);
  });

  it('rejects Sunday and other bad weekdays', () => {
    expect(validateLecturePlanForm({ ...validInput, dayOfWeek: 7 }).dayOfWeek).toBe(
      'Choose a day from Monday to Saturday.',
    );
    expect(validateLecturePlanForm({ ...validInput, dayOfWeek: 0 }).dayOfWeek).toBe(
      'Choose a day from Monday to Saturday.',
    );
  });

  it('rejects a bad start time and a bad end time', () => {
    expect(validateLecturePlanForm({ ...validInput, startTime: '8:00' }).startTime).toBe(
      'Lecture start time must be a valid 24-hour time (HH:MM).',
    );
    expect(validateLecturePlanForm({ ...validInput, endTime: '25:00' }).endTime).toBe(
      'End time must be a valid 24-hour time (HH:MM).',
    );
  });

  it('rejects an end time that is not after the start time', () => {
    expect(
      validateLecturePlanForm({ ...validInput, startTime: '10:00', endTime: '09:00' })
        .endTime,
    ).toBe('The end time must be after the start time.');
    expect(
      validateLecturePlanForm({ ...validInput, startTime: '10:00', endTime: '10:00' })
        .endTime,
    ).toBe('The end time must be after the start time.');
  });

  it('rejects a room name over 80 characters', () => {
    expect(
      validateLecturePlanForm({ ...validInput, room: 'x'.repeat(81) }).room,
    ).toBe('The room name must be 80 characters or fewer.');
  });
});

describe('groupPlansByDay', () => {
  it('groups Monday first and sorts entries by start time', () => {
    const plans = [
      makePlan({ id: 'a', day_of_week: 3, start_time: '10:00:00' }),
      makePlan({ id: 'b', day_of_week: 1, start_time: '12:00:00' }),
      makePlan({ id: 'c', day_of_week: 1, start_time: '08:00:00' }),
      makePlan({ id: 'd', day_of_week: 3, start_time: '08:00:00' }),
    ];
    const grouped = groupPlansByDay(plans);
    expect(grouped.map((g) => g.day)).toEqual([1, 3]);
    expect(grouped[0].entries.map((e) => e.id)).toEqual(['c', 'b']);
    expect(grouped[1].entries.map((e) => e.id)).toEqual(['d', 'a']);
  });

  it('returns nothing for an empty plan', () => {
    expect(groupPlansByDay([])).toEqual([]);
  });
});

describe('sessionInputForPlanEntry', () => {
  it('uses the next occurrence of the weekday, never a past date', () => {
    const course = makeCourse({
      id: 'semester-1',
      academic_session_id: 'session-1',
      name: 'First Semester',
      start_date: '2026-11-16',
      end_date: '2027-03-31',
      created_at: '2026-11-17T00:00:00Z',
    });
    const entry = makePlan({ id: 'a', day_of_week: 2, start_time: '08:00:00' });
    const input = sessionInputForPlanEntry(entry, course, TUESDAY);
    expect(input.lectureDate).toBe('2026-11-17');
    expect(input.startTime).toBe('08:00');
    expect(input.weekNumber).toBe(1);
    expect(input.title).toBe('Web Technology');
    expect(input.courseId).toBe('course-1');
    expect(input.headcount).toBeNull();
    expect(input.lectureRoomId).toBeNull();
  });

  it('uses the next occurrence when the weekday is not today', () => {
    const course = makeCourse(null);
    const entry = makePlan({ id: 'a', day_of_week: 1, start_time: '08:00:00' });
    const input = sessionInputForPlanEntry(entry, course, TUESDAY);
    expect(input.lectureDate).toBe('2026-11-23');
    expect(input.weekNumber).toBe(1);
  });

  it('suggests the semester week when the date falls inside it', () => {
    const course = makeCourse({
      id: 'semester-1',
      academic_session_id: 'session-1',
      name: 'First Semester',
      start_date: '2026-11-16',
      end_date: '2027-03-31',
      created_at: '2026-11-17T00:00:00Z',
    });
    const entry = makePlan({ id: 'a', day_of_week: 1, start_time: '08:00:00' });
    const input = sessionInputForPlanEntry(entry, course, TUESDAY);
    // 2026-11-23 is 7 days after the 2026-11-16 semester start: week 2.
    expect(input.lectureDate).toBe('2026-11-23');
    expect(input.weekNumber).toBe(2);
  });

  it('falls back to week 1 when the date is outside the semester', () => {
    const course = makeCourse({
      id: 'semester-1',
      academic_session_id: 'session-1',
      name: 'First Semester',
      start_date: '2025-09-01',
      end_date: '2026-01-31',
      created_at: '2026-11-17T00:00:00Z',
    });
    const entry = makePlan({ id: 'a', day_of_week: 2, start_time: '08:00:00' });
    const input = sessionInputForPlanEntry(entry, course, TUESDAY);
    expect(input.lectureDate).toBe('2026-11-17');
    expect(input.weekNumber).toBe(1);
  });
});

describe('mapCreateLecturePlanError', () => {
  it('maps the stable server codes to plain language', () => {
    expect(
      mapCreateLecturePlanError(
        'lecture_plan_duplicate: this lecture is already in your plan for this day and time.',
      ),
    ).toBe('This lecture is already in your plan for this day and time.');
    expect(mapCreateLecturePlanError('course_not_assigned: nope.')).toBe(
      'You are not assigned to this course. Choose one of your courses.',
    );
    expect(mapCreateLecturePlanError('course_not_found: nope.')).toBe(
      'The selected course does not exist. Choose another course.',
    );
    expect(mapCreateLecturePlanError('lecturer_profile_not_found: nope.')).toBe(
      'Your account has no lecturer profile yet. Ask your university administrator to create one for your account.',
    );
  });

  it('falls back to the human part after the colon, then a generic line', () => {
    expect(mapCreateLecturePlanError('something_else: the database is down.')).toBe(
      'the database is down.',
    );
    expect(mapCreateLecturePlanError('boom')).toBe(
      'The lecture could not be added to your plan. Try again.',
    );
  });
});
