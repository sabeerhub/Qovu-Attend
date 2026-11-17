import { describe, expect, it } from 'vitest';
import {
  EMPTY_HISTORY_FILTERS,
  filterHistorySessions,
  hasHistoryFilters,
  type HistorySessionRow,
} from '@/lib/history';

function row(overrides: Partial<HistorySessionRow> = {}): HistorySessionRow {
  return {
    id: 's1',
    course_id: 'c1',
    lecturer_id: 'l1',
    semester_id: 'sem1',
    lecture_room_id: null,
    title: 'Week 3 Lecture',
    lecture_date: '2026-11-10',
    start_time: '09:00',
    week_number: 3,
    headcount: 40,
    qr_expires_in_seconds: 300,
    status: 'finalized',
    created_at: '2026-11-10T08:00:00.000Z',
    updated_at: '2026-11-10T08:00:00.000Z',
    qr_token_hash: null,
    qr_token_issued_at: null,
    passcode_hash: null,
    anchor_latitude: null,
    anchor_longitude: null,
    anchor_accuracy_meters: null,
    anchor_captured_at: null,
    location_radius_meters: 30,
    courses: { code: 'CSC 301', department_id: 'd1' },
    ...overrides,
  };
}

const ROWS = [
  row({ id: 's1', lecture_date: '2026-11-10', status: 'finalized' }),
  row({
    id: 's2',
    course_id: 'c2',
    title: 'Week 4 Lecture',
    lecture_date: '2026-11-17',
    week_number: 4,
    status: 'active',
    courses: { code: 'CIT 301', department_id: 'd2' },
  }),
  row({
    id: 's3',
    title: 'Week 5 Lecture',
    lecture_date: '2026-11-24',
    week_number: 5,
    status: 'closed',
    courses: { code: 'CSC 301', department_id: 'd1' },
  }),
];

describe('history filters', () => {
  it('returns everything when no filter is set', () => {
    expect(filterHistorySessions(ROWS, EMPTY_HISTORY_FILTERS)).toEqual(ROWS);
    expect(hasHistoryFilters(EMPTY_HISTORY_FILTERS)).toBe(false);
  });

  it('filters by department', () => {
    const filtered = filterHistorySessions(ROWS, { ...EMPTY_HISTORY_FILTERS, departmentId: 'd1' });
    expect(filtered.map((r) => r.id)).toEqual(['s1', 's3']);
  });

  it('filters by course', () => {
    const filtered = filterHistorySessions(ROWS, { ...EMPTY_HISTORY_FILTERS, courseId: 'c2' });
    expect(filtered.map((r) => r.id)).toEqual(['s2']);
  });

  it('filters by status', () => {
    const filtered = filterHistorySessions(ROWS, { ...EMPTY_HISTORY_FILTERS, status: 'finalized' });
    expect(filtered.map((r) => r.id)).toEqual(['s1']);
    expect(hasHistoryFilters({ ...EMPTY_HISTORY_FILTERS, status: 'finalized' })).toBe(true);
  });

  it('filters by date range, inclusive on both ends', () => {
    const filtered = filterHistorySessions(ROWS, {
      ...EMPTY_HISTORY_FILTERS,
      dateFrom: '2026-11-10',
      dateTo: '2026-11-17',
    });
    expect(filtered.map((r) => r.id)).toEqual(['s1', 's2']);
  });

  it('filters by a single date bound', () => {
    expect(
      filterHistorySessions(ROWS, { ...EMPTY_HISTORY_FILTERS, dateFrom: '2026-11-17' }).map(
        (r) => r.id,
      ),
    ).toEqual(['s2', 's3']);
    expect(
      filterHistorySessions(ROWS, { ...EMPTY_HISTORY_FILTERS, dateTo: '2026-11-10' }).map(
        (r) => r.id,
      ),
    ).toEqual(['s1']);
  });

  it('combines filters — all of them must match', () => {
    const filtered = filterHistorySessions(ROWS, {
      ...EMPTY_HISTORY_FILTERS,
      departmentId: 'd1',
      status: 'closed',
    });
    expect(filtered.map((r) => r.id)).toEqual(['s3']);
  });

  it('returns nothing when nothing matches', () => {
    expect(
      filterHistorySessions(ROWS, { ...EMPTY_HISTORY_FILTERS, courseId: 'c9' }),
    ).toEqual([]);
  });
});
