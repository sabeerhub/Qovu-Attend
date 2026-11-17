import { describe, expect, it } from 'vitest';
import {
  BULK_MARK_REASON,
  bulkMarkResultMessage,
  computeBulkMarkPreview,
} from '@/lib/bulkMark';
import type { AttendanceRecord, CourseStudent } from '@/types/database';

function student(reg_number: string): CourseStudent {
  return {
    id: `stu-${reg_number}`,
    course_id: 'c1',
    reg_number,
    student_name: null,
    created_at: '2026-11-17T00:00:00.000Z',
  };
}

function record(
  registration_number: string,
  status: AttendanceRecord['status'],
): Pick<AttendanceRecord, 'registration_number' | 'status'> {
  return { registration_number, status };
}

describe('computeBulkMarkPreview', () => {
  it('counts on-list, already submitted and to-mark', () => {
    expect(
      computeBulkMarkPreview({
        roster: [student('FUT/2022/001'), student('FUT/2022/002'), student('FUT/2022/003')],
        records: [record('FUT/2022/002', 'verified')],
        headcount: 3,
      }),
    ).toEqual({
      onList: 3,
      alreadySubmitted: 1,
      toMark: 2,
      headcount: 3,
      willExceedHeadcount: false,
    });
  });

  it('counts a repeated number on the list once, and matches case-insensitively', () => {
    expect(
      computeBulkMarkPreview({
        roster: [student('fut/2022/001'), student('FUT/2022/001')],
        records: [],
        headcount: null,
      }),
    ).toEqual({
      onList: 1,
      alreadySubmitted: 0,
      toMark: 1,
      headcount: null,
      willExceedHeadcount: null,
    });
  });

  it('to-mark is zero when everyone already submitted', () => {
    expect(
      computeBulkMarkPreview({
        roster: [student('FUT/2022/001')],
        records: [record('FUT/2022/001', 'manual')],
        headcount: 1,
      }),
    ).toEqual({
      onList: 1,
      alreadySubmitted: 1,
      toMark: 0,
      headcount: 1,
      willExceedHeadcount: false,
    });
  });

  it('warns when verified + manual after the mark will pass the headcount', () => {
    // 2 verified already, headcount 3, 2 more to mark → 4 > 3.
    const preview = computeBulkMarkPreview({
      roster: [
        student('FUT/2022/001'),
        student('FUT/2022/002'),
        student('FUT/2022/003'),
        student('FUT/2022/004'),
      ],
      records: [record('FUT/2022/001', 'verified'), record('FUT/2022/002', 'verified')],
      headcount: 3,
    });
    expect(preview.willExceedHeadcount).toBe(true);
    expect(preview.toMark).toBe(2);
  });

  it('pending and rejected records do not count toward verified + manual', () => {
    const preview = computeBulkMarkPreview({
      roster: [student('FUT/2022/001'), student('FUT/2022/002')],
      records: [record('FUT/2022/001', 'pending')],
      headcount: 1,
    });
    // 0 verified/manual + 1 to mark = 1, not above the headcount of 1.
    expect(preview.willExceedHeadcount).toBe(false);
    expect(preview.toMark).toBe(1);
  });

  it('no headcount recorded means no comparison is possible', () => {
    const preview = computeBulkMarkPreview({
      roster: [student('FUT/2022/001')],
      records: [],
      headcount: null,
    });
    expect(preview.willExceedHeadcount).toBeNull();
  });
});

describe('bulkMarkResultMessage', () => {
  it('says how many were marked', () => {
    expect(
      bulkMarkResultMessage({
        ok: true,
        marked: 42,
        skipped: 0,
        failed: 0,
        failedNumbers: [],
      }),
    ).toBe('Marked 42 students as arrived.');
  });

  it('says how many were skipped because they already submitted', () => {
    expect(
      bulkMarkResultMessage({
        ok: true,
        marked: 40,
        skipped: 2,
        failed: 0,
        failedNumbers: [],
      }),
    ).toBe('Marked 40 students as arrived. 2 already submitted, so they were skipped.');
  });

  it('reports a partial failure plainly, with the numbers that failed', () => {
    expect(
      bulkMarkResultMessage({
        ok: true,
        marked: 40,
        skipped: 1,
        failed: 2,
        failedNumbers: ['FUT/2022/009', 'FUT/2022/010'],
      }),
    ).toBe(
      'Marked 40 students as arrived. 1 already submitted, so that student was skipped. ' +
        '2 could not be marked: FUT/2022/009, FUT/2022/010. Try again, or add them by hand.',
    );
  });

  it('a second run says nobody new was marked', () => {
    expect(
      bulkMarkResultMessage({
        ok: true,
        marked: 0,
        skipped: 5,
        failed: 0,
        failedNumbers: [],
      }),
    ).toBe('Nobody new was marked. 5 already submitted, so they were skipped.');
  });
});

describe('BULK_MARK_REASON', () => {
  it('is the one shared reason for every bulk-marked record', () => {
    expect(BULK_MARK_REASON).toBe('Marked all as arrived by lecturer');
  });
});
