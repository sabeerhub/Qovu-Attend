import { describe, expect, it, vi } from 'vitest';
import {
  bandForPercentage,
  computeEligibility,
  DEFAULT_ELIGIBILITY_THRESHOLD,
  isHeldSession,
  isPresentStatus,
  isValidThreshold,
  mapSetThresholdError,
  setEligibilityThreshold,
  validateThreshold,
  type EligibilityInput,
  type EligibilityRecord,
  type EligibilitySession,
} from '@/lib/eligibility';

function makeSession(
  id: string,
  week: number,
  status: EligibilitySession['status'],
): EligibilitySession {
  return { id, week_number: week, status };
}

function makeRecord(
  sessionId: string,
  reg: string,
  status: EligibilityRecord['status'],
): EligibilityRecord {
  return { session_id: sessionId, registration_number: reg, status };
}

const STUDENTS = [
  { reg_number: 'FUD/001', student_name: 'Amina Bello' },
  { reg_number: 'FUD/002', student_name: null },
];

/** Four locked sessions (weeks 1–4) and one of each other status. */
function baseInput(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    sessions: [
      makeSession('s1', 1, 'finalized'),
      makeSession('s2', 2, 'finalized'),
      makeSession('s3', 3, 'archived'),
      makeSession('s4', 4, 'finalized'),
      makeSession('s5', 5, 'draft'),
      makeSession('s6', 6, 'active'),
      makeSession('s7', 7, 'closed'),
    ],
    records: [
      makeRecord('s1', 'FUD/001', 'verified'),
      makeRecord('s2', 'FUD/001', 'manual'),
      makeRecord('s3', 'FUD/001', 'verified'),
      makeRecord('s4', 'FUD/001', 'pending'),
      makeRecord('s1', 'FUD/002', 'verified'),
    ],
    students: STUDENTS,
    threshold: 75,
    ...overrides,
  };
}

describe('isPresentStatus', () => {
  it('verified and manual count as present', () => {
    expect(isPresentStatus('verified')).toBe(true);
    expect(isPresentStatus('manual')).toBe(true);
  });

  it('pending, rejected and suspicious do not count as present', () => {
    expect(isPresentStatus('pending')).toBe(false);
    expect(isPresentStatus('rejected')).toBe(false);
    expect(isPresentStatus('suspicious')).toBe(false);
  });
});

describe('isHeldSession', () => {
  it('only finalized and archived sessions count as held', () => {
    expect(isHeldSession(makeSession('a', 1, 'finalized'))).toBe(true);
    expect(isHeldSession(makeSession('a', 1, 'archived'))).toBe(true);
    expect(isHeldSession(makeSession('a', 1, 'draft'))).toBe(false);
    expect(isHeldSession(makeSession('a', 1, 'active'))).toBe(false);
    expect(isHeldSession(makeSession('a', 1, 'closed'))).toBe(false);
  });
});

describe('computeEligibility — attended / held math', () => {
  it('counts verified and manual as attended, pending as not', () => {
    const rows = computeEligibility(baseInput());
    const amina = rows.find((r) => r.regNumber === 'FUD/001');
    expect(amina).toBeDefined();
    // s1 verified, s2 manual, s3 verified, s4 pending (not present).
    expect(amina?.attended).toBe(3);
    expect(amina?.held).toBe(4);
    expect(amina?.percentage).toBe(75);
    expect(amina?.band).toBe('approaching');
  });

  it('ignores records in draft, active and closed sessions', () => {
    const rows = computeEligibility(
      baseInput({
        records: [
          makeRecord('s5', 'FUD/001', 'verified'),
          makeRecord('s6', 'FUD/001', 'verified'),
          makeRecord('s7', 'FUD/001', 'verified'),
        ],
      }),
    );
    const amina = rows.find((r) => r.regNumber === 'FUD/001');
    expect(amina?.attended).toBe(0);
    expect(amina?.held).toBe(4);
    expect(amina?.percentage).toBe(0);
    expect(amina?.band).toBe('below');
  });

  it('a class-list student with no records shows 0%', () => {
    const rows = computeEligibility(baseInput({ records: [] }));
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.attended).toBe(0);
      expect(row.held).toBe(4);
      expect(row.percentage).toBe(0);
      expect(row.band).toBe('below');
    }
  });

  it('a number with records but not on the list still gets a row, without a name', () => {
    const rows = computeEligibility(
      baseInput({
        students: [],
        records: [makeRecord('s1', 'FUD/999', 'verified')],
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].regNumber).toBe('FUD/999');
    expect(rows[0].studentName).toBeNull();
    expect(rows[0].attended).toBe(1);
    expect(rows[0].percentage).toBe(25);
  });

  it('a number with only pending records in held sessions gets a 0% row', () => {
    const rows = computeEligibility(
      baseInput({
        students: [],
        records: [makeRecord('s1', 'FUD/999', 'pending')],
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].attended).toBe(0);
    expect(rows[0].percentage).toBe(0);
    expect(rows[0].band).toBe('below');
  });

  it('a number with records only in non-held sessions gets no row', () => {
    const rows = computeEligibility(
      baseInput({
        students: [],
        records: [makeRecord('s5', 'FUD/999', 'verified')],
      }),
    );
    expect(rows).toHaveLength(0);
  });

  it('no held sessions yet: percentage and band are null', () => {
    const rows = computeEligibility(
      baseInput({
        sessions: [makeSession('s5', 5, 'draft')],
        records: [],
      }),
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.held).toBe(0);
      expect(row.percentage).toBeNull();
      expect(row.band).toBeNull();
      expect(row.weeks).toEqual(Array(15).fill('no-session'));
    }
  });

  it('rows are sorted by registration number and carry the class-list name', () => {
    const rows = computeEligibility(baseInput());
    expect(rows.map((r) => r.regNumber)).toEqual(['FUD/001', 'FUD/002']);
    expect(rows[0].studentName).toBe('Amina Bello');
    expect(rows[1].studentName).toBeNull();
  });
});

describe('bandForPercentage — the exact percentage decides', () => {
  it('74.6% is below a 75% bar: the exact value decides, never the rounded one', () => {
    expect(bandForPercentage(74.6, 75)).toBe('below');
    expect(bandForPercentage(74.99, 75)).toBe('below');
  });

  it('exactly at the bar is approaching, not below', () => {
    expect(bandForPercentage(75, 75)).toBe('approaching');
    expect(bandForPercentage(84.9, 75)).toBe('approaching');
  });

  it('10 points above the bar is safe', () => {
    expect(bandForPercentage(85, 75)).toBe('safe');
    expect(bandForPercentage(100, 75)).toBe('safe');
  });

  it('the bands move with the bar', () => {
    // 80% is safe at a 70% bar, approaching at 75%, below at 85%.
    expect(bandForPercentage(80, 70)).toBe('safe');
    expect(bandForPercentage(80, 75)).toBe('approaching');
    expect(bandForPercentage(80, 85)).toBe('below');
  });

  it('changing the bar moves the bands for the same rows', () => {
    const at75 = computeEligibility(baseInput({ threshold: 75 }));
    const at85 = computeEligibility(baseInput({ threshold: 85 }));
    const at60 = computeEligibility(baseInput({ threshold: 60 }));
    const amina75 = at75.find((r) => r.regNumber === 'FUD/001');
    const amina85 = at85.find((r) => r.regNumber === 'FUD/001');
    const amina60 = at60.find((r) => r.regNumber === 'FUD/001');
    expect(amina75?.band).toBe('approaching'); // 75% at a 75 bar
    expect(amina85?.band).toBe('below'); // 75% at an 85 bar
    expect(amina60?.band).toBe('safe'); // 75% at a 60 bar
  });
});

describe('computeEligibility — week map (W1–W15)', () => {
  it('maps attended, missed and no-session weeks', () => {
    const rows = computeEligibility(baseInput());
    const amina = rows.find((r) => r.regNumber === 'FUD/001');
    // W1 verified, W2 manual, W3 verified, W4 pending (missed),
    // W5–W7 not held, W8–W15 no sessions at all.
    expect(amina?.weeks).toEqual([
      'attended',
      'attended',
      'attended',
      'missed',
      'no-session',
      'no-session',
      'no-session',
      'no-session',
      'no-session',
      'no-session',
      'no-session',
      'no-session',
      'no-session',
      'no-session',
      'no-session',
    ]);
  });

  it('a week with two sessions shows attended when the student was present in one of them', () => {
    const rows = computeEligibility(
      baseInput({
        sessions: [
          makeSession('s1', 1, 'finalized'),
          makeSession('s1b', 1, 'finalized'),
          makeSession('s2', 2, 'finalized'),
        ],
        records: [
          makeRecord('s1', 'FUD/001', 'verified'),
          makeRecord('s2', 'FUD/001', 'pending'),
        ],
      }),
    );
    const amina = rows.find((r) => r.regNumber === 'FUD/001');
    expect(amina?.attended).toBe(1);
    expect(amina?.held).toBe(3);
    expect(amina?.weeks[0]).toBe('attended');
    expect(amina?.weeks[1]).toBe('missed');
  });
});

describe('threshold validation', () => {
  it('the default bar is 75 and 0–100 whole numbers are valid', () => {
    expect(DEFAULT_ELIGIBILITY_THRESHOLD).toBe(75);
    expect(isValidThreshold(0)).toBe(true);
    expect(isValidThreshold(75)).toBe(true);
    expect(isValidThreshold(100)).toBe(true);
    expect(validateThreshold(75)).toBeNull();
  });

  it('rejects out-of-range, fractional and non-number bars', () => {
    expect(isValidThreshold(-1)).toBe(false);
    expect(isValidThreshold(101)).toBe(false);
    expect(isValidThreshold(74.5)).toBe(false);
    expect(isValidThreshold('75')).toBe(false);
    expect(isValidThreshold(null)).toBe(false);
    expect(validateThreshold(101)).toBe('The bar must be a whole number between 0 and 100.');
  });
});

describe('mapSetThresholdError', () => {
  it('maps the RPC error codes to plain words', () => {
    expect(mapSetThresholdError('course_not_assigned: x')).toBe(
      'You are not assigned to this course.',
    );
    expect(mapSetThresholdError('course_not_found: x')).toBe('This course does not exist any more.');
    expect(mapSetThresholdError('threshold_invalid: x')).toBe(
      'The bar must be a whole number between 0 and 100.',
    );
    expect(mapSetThresholdError('lecturer_profile_not_found: x')).toContain('lecturer profile');
  });

  it('falls back to the detail after the colon, then a generic message', () => {
    expect(mapSetThresholdError('something_else: the database is down')).toBe(
      'the database is down',
    );
    expect(mapSetThresholdError('boom')).toBe('The bar could not be saved. Try again.');
  });
});

describe('setEligibilityThreshold', () => {
  it('returns the saved bar on success', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 80, error: null });
    const result = await setEligibilityThreshold(
      { rpc } as never,
      'course-1',
      80,
    );
    expect(result).toEqual({ threshold: 80 });
    expect(rpc).toHaveBeenCalledWith('set_eligibility_threshold', {
      p_course_id: 'course-1',
      p_threshold: 80,
    });
  });

  it('maps a server refusal to plain words', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'course_not_assigned: no' } });
    const result = await setEligibilityThreshold({ rpc } as never, 'course-1', 80);
    expect(result).toEqual({ error: 'You are not assigned to this course.' });
  });

  it('reports an error when the server returns no number', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const result = await setEligibilityThreshold({ rpc } as never, 'course-1', 80);
    expect(result).toEqual({ error: 'The bar could not be saved. Try again.' });
  });
});
