import { describe, expect, it } from 'vitest';
import { escapeCsvValue, toCsv, toCsvRow } from '@/lib/csv';

describe('CSV escaping', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCsvValue('CIT 301')).toBe('CIT 301');
    expect(escapeCsvValue(60)).toBe('60');
  });

  it('quotes values containing commas, quotes or newlines', () => {
    expect(escapeCsvValue('a,b')).toBe('"a,b"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
  });

  it('returns an empty string for null and undefined', () => {
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
  });

  it('neutralizes formula injection at the start of a cell', () => {
    expect(escapeCsvValue('=1+1')).toBe("'=1+1");
    expect(escapeCsvValue('+1+1')).toBe("'+1+1");
    expect(escapeCsvValue('-1+1')).toBe("'-1+1");
    expect(escapeCsvValue('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
    // A formula character later in the value is not a formula.
    expect(escapeCsvValue('grade = A')).toBe('grade = A');
  });

  it('builds rows and a full CSV document', () => {
    expect(toCsvRow(['CIT 301', 'FUD/2021/001', 'verified'])).toBe('CIT 301,FUD/2021/001,verified');
    expect(
      toCsv(['code', 'reg_no'], [
        ['CIT 301', 'FUD/2021/001'],
        ['CIT 305', 'FUD/2021,002'],
      ]),
    ).toBe('code,reg_no\r\nCIT 301,FUD/2021/001\r\nCIT 305,"FUD/2021,002"');
  });
});
