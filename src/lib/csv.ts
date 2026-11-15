/**
 * CSV helpers (Phase 3 export contract, docs/API_CONTRACTS.md).
 * RFC 4180 escaping + formula-injection neutralization, so a value
 * that starts with =, +, - or @ can never be executed as a formula
 * when the file is opened in a spreadsheet.
 */

const FORMULA_PREFIXES = ['=', '+', '-', '@'];

function neutralizeFormula(value: string): string {
  if (FORMULA_PREFIXES.includes(value.charAt(0))) {
    return `'${value}`;
  }
  return value;
}

export function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const raw = neutralizeFormula(String(value));
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function toCsvRow(values: Array<string | number | null | undefined>): string {
  return values.map(escapeCsvValue).join(',');
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  return [toCsvRow(headers), ...rows.map(toCsvRow)].join('\r\n');
}
