/**
 * Student roster helpers (v0.9.0 — Students module, pure, tested).
 *
 * A course's class list is the list of registration numbers the
 * lecturer has registered for that course. The server only accepts
 * attendance from a registration number on the list — but only when
 * the list is not empty (see the roster rule in
 * `supabase/functions/attendance-submit/rosterCheck.ts`); a lecturer
 * who has not added any students yet is never locked out.
 *
 * Registration numbers are normalized the same way everywhere in
 * this product (trim + uppercase — see `normalizeRegistrationNumber`
 * in `src/lib/submission.ts`); the database trigger on
 * `course_students` applies the same rule, so the stored form can
 * never drift from the compared form.
 */

import { normalizeRegistrationNumber } from './submission';

/** A registration number is at most 100 characters (DB check). */
export const MAX_REG_NUMBER_LENGTH = 100;
/** A student name is at most 100 characters (DB check). */
export const MAX_STUDENT_NAME_LENGTH = 100;
/** Students shown per page in the course's Students view. */
export const STUDENTS_PAGE_SIZE = 25;

/** One parsed CSV row: a registration number + optional name. */
export interface CsvStudentRow {
  /** Normalized (trimmed + uppercased) registration number. */
  regNumber: string;
  /** Trimmed name, or null when the file has no name for this row. */
  name: string | null;
  /** 1-based line number in the file, for pointing at problems. */
  line: number;
}

export interface CsvParseError {
  /** 1-based line number in the file. */
  line: number;
  message: string;
}

export interface ParsedStudentCsv {
  rows: CsvStudentRow[];
  errors: CsvParseError[];
}

/** Header spellings accepted for the registration-number column. */
const REG_HEADERS = new Set([
  'reg number',
  'registration number',
  'reg no',
  'regno',
  'reg',
]);

/** Header spellings accepted for the name column. */
const NAME_HEADERS = new Set(['name', 'student name', 'full name', 'fullname']);

function headerKey(cell: string): string {
  // "Reg_Number", "REG NUMBER" and "reg number" are the same header.
  return cell.trim().toLowerCase().replace(/[_\s]+/g, ' ');
}

/**
 * Parse one CSV document into rows of cells, RFC 4180 style:
 * commas separate cells, a newline ends a row, and a cell wrapped
 * in double quotes may contain commas, quotes (`""` = one `"`) and
 * newlines. Blank rows are skipped. Each row carries the 1-based
 * line number where it started, so problems can be pointed at.
 */
function parseCsvCells(text: string): Array<{ cells: string[]; line: number }> {
  const rows: Array<{ cells: string[]; line: number }> = [];
  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldQuoted = false;
  let rowStartLine = 1;
  let line = 1;
  let fieldStarted = false;

  const endField = () => {
    cells.push(field);
    field = '';
    fieldQuoted = false;
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    if (cells.some((c) => c.trim() !== '')) {
      rows.push({ cells, line: rowStartLine });
    }
    cells = [];
    rowStartLine = line + 1;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line += 1;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldQuoted = true;
      fieldStarted = true;
      continue;
    }
    if (ch === ',') {
      endField();
      continue;
    }
    if (ch === '\r') {
      // CRLF: the \n that follows is part of the same line break.
      if (text[i + 1] === '\n') i += 1;
      endRow();
      line += 1;
      continue;
    }
    if (ch === '\n') {
      endRow();
      line += 1;
      continue;
    }
    field += ch;
    fieldStarted = true;
  }
  // Trailing row without a final newline.
  if (fieldStarted || fieldQuoted || cells.length > 0 || field !== '') {
    endRow();
  }
  return rows;
}

/**
 * Parse a CSV file of students. The first row is a header when it
 * names the registration-number column (`reg_number`,
 * `registration_number`, `reg_no`, … — case-insensitive); the name
 * column (`name`, `student_name`, …) is optional. Without a header
 * the first column is the registration number and the second, when
 * present, is the name. Rows with problems are reported with their
 * line number and left out — the good rows still import.
 */
export function parseStudentCsv(text: string): ParsedStudentCsv {
  const rawRows = parseCsvCells(text);
  const rows: CsvStudentRow[] = [];
  const errors: CsvParseError[] = [];
  if (rawRows.length === 0) return { rows, errors };

  let startIndex = 0;
  let regIndex = 0;
  let nameIndex = -1;
  const first = rawRows[0];
  const headerKeys = first.cells.map(headerKey);
  const foundReg = headerKeys.findIndex((k) => REG_HEADERS.has(k));
  if (foundReg >= 0) {
    startIndex = 1;
    regIndex = foundReg;
    nameIndex = headerKeys.findIndex((k) => NAME_HEADERS.has(k));
  } else if (first.cells.length >= 2) {
    nameIndex = 1;
  }

  for (let i = startIndex; i < rawRows.length; i++) {
    const { cells, line } = rawRows[i];
    const rawReg = cells[regIndex] ?? '';
    const regNumber = normalizeRegistrationNumber(rawReg);
    if (regNumber.length === 0) {
      errors.push({ line, message: 'Registration number is missing.' });
      continue;
    }
    if (regNumber.length > MAX_REG_NUMBER_LENGTH) {
      errors.push({
        line,
        message: `Registration number is too long (over ${MAX_REG_NUMBER_LENGTH} characters).`,
      });
      continue;
    }
    const rawName = nameIndex >= 0 ? (cells[nameIndex] ?? '').trim() : '';
    if (rawName.length > MAX_STUDENT_NAME_LENGTH) {
      errors.push({
        line,
        message: `Name is too long (over ${MAX_STUDENT_NAME_LENGTH} characters).`,
      });
      continue;
    }
    rows.push({ regNumber, name: rawName === '' ? null : rawName, line });
  }
  return { rows, errors };
}

export interface ClassifiedImport {
  /** New students that will be added. */
  toAdd: CsvStudentRow[];
  /** Rows whose registration number is already on this course's list. */
  alreadyInCourse: CsvStudentRow[];
  /** Rows repeated inside the file itself (first copy wins). */
  duplicatesInFile: CsvStudentRow[];
}

/**
 * Sort parsed rows into what will be added, what is already on the
 * course's list, and what is repeated inside the file. `existing`
 * holds the normalized registration numbers already on the list.
 * Comparison is always on the normalized form.
 */
export function classifyImportRows(
  rows: readonly CsvStudentRow[],
  existing: ReadonlySet<string>,
): ClassifiedImport {
  const toAdd: CsvStudentRow[] = [];
  const alreadyInCourse: CsvStudentRow[] = [];
  const duplicatesInFile: CsvStudentRow[] = [];
  const seenInFile = new Set<string>();
  // The existing set comes from the database (already normalized by
  // the trigger), but normalize both sides anyway: this function
  // must never depend on its caller having normalized first.
  const existingNormalized = new Set([...existing].map(normalizeRegistrationNumber));
  for (const row of rows) {
    const regNumber = normalizeRegistrationNumber(row.regNumber);
    const normalizedRow = { ...row, regNumber };
    if (existingNormalized.has(regNumber)) {
      alreadyInCourse.push(normalizedRow);
      continue;
    }
    if (seenInFile.has(regNumber)) {
      duplicatesInFile.push(normalizedRow);
      continue;
    }
    seenInFile.add(regNumber);
    toAdd.push(normalizedRow);
  }
  return { toAdd, alreadyInCourse, duplicatesInFile };
}

export interface ManualStudentInput {
  regNumber: string;
  name: string;
}

/**
 * Validate the add-one-student form. Returns a plain-language error
 * or null when the input is fine.
 */
export function validateManualStudent(input: ManualStudentInput): string | null {
  const regNumber = normalizeRegistrationNumber(input.regNumber);
  if (regNumber.length === 0) {
    return 'Enter a student registration number.';
  }
  if (regNumber.length > MAX_REG_NUMBER_LENGTH) {
    return `Registration number is too long (over ${MAX_REG_NUMBER_LENGTH} characters).`;
  }
  if (input.name.trim().length > MAX_STUDENT_NAME_LENGTH) {
    return `Name is too long (over ${MAX_STUDENT_NAME_LENGTH} characters).`;
  }
  return null;
}
