import { describe, expect, it } from 'vitest';
import {
  classifyImportRows,
  parseStudentCsv,
  validateManualStudent,
  type CsvStudentRow,
} from '@/lib/students';

function row(regNumber: string, name: string | null = null, line = 1): CsvStudentRow {
  return { regNumber, name, line };
}

describe('parseStudentCsv', () => {
  it('parses a header row with reg_number + name', () => {
    const { rows, errors } = parseStudentCsv(
      'reg_number,name\nFUD/2022/001,Amina Bello\nFUD/2022/002,Chidi Okafor\n',
    );
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      row('FUD/2022/001', 'Amina Bello', 2),
      row('FUD/2022/002', 'Chidi Okafor', 3),
    ]);
  });

  it('accepts header variants case-insensitively', () => {
    for (const header of ['Registration_Number,Student_Name', 'REG NO,NAME', 'Reg Number,Full Name']) {
      const { rows, errors } = parseStudentCsv(`${header}\nabc/1,Some One\n`);
      expect(errors).toEqual([]);
      expect(rows).toEqual([row('ABC/1', 'Some One', 2)]);
    }
  });

  it('treats a file with no header as data (first column reg, second name)', () => {
    const { rows, errors } = parseStudentCsv('FUD/2022/001,Amina Bello\nFUD/2022/002\n');
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      row('FUD/2022/001', 'Amina Bello', 1),
      row('FUD/2022/002', null, 2),
    ]);
  });

  it('normalizes registration numbers (trim + uppercase)', () => {
    const { rows } = parseStudentCsv('reg_number\n  u19/cs/001  \n');
    expect(rows).toEqual([row('U19/CS/001', null, 2)]);
  });

  it('handles quoted fields with commas and quotes, and CRLF line endings', () => {
    const { rows, errors } = parseStudentCsv(
      'reg_number,name\r\nFUD/2022/003,"Bello, Amina"\r\nFUD/2022/004,"Say ""hi"""\r\n',
    );
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      row('FUD/2022/003', 'Bello, Amina', 2),
      row('FUD/2022/004', 'Say "hi"', 3),
    ]);
  });

  it('reports rows with a missing registration number, with line numbers', () => {
    const { rows, errors } = parseStudentCsv('reg_number,name\nFUD/2022/001,Amina\n,No Number\nFUD/2022/002,Chidi\n');
    expect(rows.map((r) => r.regNumber)).toEqual(['FUD/2022/001', 'FUD/2022/002']);
    expect(errors).toEqual([{ line: 3, message: 'Registration number is missing.' }]);
  });

  it('reports an over-long registration number and name', () => {
    const longReg = 'R'.repeat(101);
    const longName = 'N'.repeat(101);
    const { rows, errors } = parseStudentCsv(
      `reg_number,name\n${longReg},Ok\nFUD/1,${longName}\n`,
    );
    expect(rows).toEqual([]);
    expect(errors).toEqual([
      { line: 2, message: 'Registration number is too long (over 100 characters).' },
      { line: 3, message: 'Name is too long (over 100 characters).' },
    ]);
  });

  it('skips blank lines and returns empty for an empty file', () => {
    expect(parseStudentCsv('')).toEqual({ rows: [], errors: [] });
    expect(parseStudentCsv('\n\n')).toEqual({ rows: [], errors: [] });
    const { rows, errors } = parseStudentCsv('reg_number,name\n\nFUD/2022/001,Amina\n\n');
    expect(errors).toEqual([]);
    expect(rows).toEqual([row('FUD/2022/001', 'Amina', 3)]);
  });

  it('treats a name column as optional', () => {
    const { rows, errors } = parseStudentCsv('reg_number\nFUD/2022/001\n');
    expect(errors).toEqual([]);
    expect(rows).toEqual([row('FUD/2022/001', null, 2)]);
  });
});

describe('classifyImportRows', () => {
  it('splits new, already-on-the-list, and repeated-in-file rows', () => {
    const rows = [
      row('FUD/2022/001', 'Amina', 2),
      row('FUD/2022/002', 'Chidi', 3),
      // Lowercase repeat of the first row: normalization makes it
      // the same student, so it is a duplicate in the file.
      row('fud/2022/001', 'Amina Again', 4),
      row('FUD/2022/003', 'Bola', 5),
      row('FUD/2022/003', 'Bola Again', 6),
    ];
    const existing = new Set(['FUD/2022/002']);
    const result = classifyImportRows(rows, existing);
    expect(result.toAdd.map((r) => r.regNumber)).toEqual(['FUD/2022/001', 'FUD/2022/003']);
    expect(result.alreadyInCourse.map((r) => r.regNumber)).toEqual(['FUD/2022/002']);
    expect(result.duplicatesInFile.map((r) => r.regNumber)).toEqual([
      'FUD/2022/001',
      'FUD/2022/003',
    ]);
  });

  it('is case-insensitive against the existing list', () => {
    const result = classifyImportRows(
      [row('fud/2022/001', null, 2)],
      new Set(['FUD/2022/001']),
    );
    // classifyImportRows compares normalized forms: a lowercase
    // input must match an uppercase existing entry.
    expect(result.alreadyInCourse).toHaveLength(1);
    expect(result.toAdd).toHaveLength(0);
  });
});

describe('validateManualStudent', () => {
  it('requires a registration number', () => {
    expect(validateManualStudent({ regNumber: '   ', name: '' })).toBe(
      'Enter a student registration number.',
    );
    expect(validateManualStudent({ regNumber: 'FUD/1', name: '' })).toBeNull();
  });

  it('rejects over-long values', () => {
    expect(validateManualStudent({ regNumber: 'R'.repeat(101), name: '' })).toContain('too long');
    expect(validateManualStudent({ regNumber: 'FUD/1', name: 'N'.repeat(101) })).toContain(
      'too long',
    );
  });
});
