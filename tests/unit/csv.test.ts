import { describe, expect, it } from 'vitest';
import { escapeCsvValue, toCsv, toCsvRow, toCsvWithBom } from '@/lib/csv';

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

  it('neutralizes a leading tab or carriage return (v0.14.0)', () => {
    // Some spreadsheet apps strip leading whitespace and then read
    // the next character as a formula trigger, so the tab / CR
    // itself must be neutralized.
    expect(escapeCsvValue('\t=1+1')).toBe("'\t=1+1");
    // A carriage return also forces RFC 4180 quoting around the
    // whole cell — the leading quote still neutralizes the formula.
    expect(escapeCsvValue('\r=1+1')).toBe('"\'\r=1+1"');
    expect(escapeCsvValue('\tplain')).toBe("'\tplain");
  });

  it('prepends a UTF-8 BOM (v0.14.0)', () => {
    expect(toCsvWithBom(['a'], [['b']])).toBe('\uFEFFa\r\nb');
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
