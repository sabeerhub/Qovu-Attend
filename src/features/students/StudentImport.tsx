import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  classifyImportRows,
  parseStudentCsv,
  type CsvParseError,
  type ClassifiedImport,
} from '@/lib/students';
import { toCsv } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PreviewState {
  fileName: string;
  classified: ClassifiedImport;
  errors: CsvParseError[];
  totalRows: number;
}

/**
 * CSV import for one course's class list.
 *
 * The lecturer picks a .csv file (registration number column
 * required, name column optional). Nothing is saved until the
 * preview is confirmed: the preview shows what will be added, what
 * is already on the list, what is repeated inside the file, and
 * which rows have problems. Saving inserts only the new rows; the
 * database unique constraint is the backstop against duplicates.
 *
 * Excel (.xlsx) is not supported in this version — the lecturer
 * saves the sheet as CSV first. The sample file shows the format.
 */
export function StudentImport({
  courseId,
  existingRegNumbers,
  onImported,
}: {
  courseId: string;
  existingRegNumbers: ReadonlySet<string>;
  onImported: (added: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function onFileChosen(file: File | undefined) {
    setFileError(null);
    setImportError(null);
    setPreview(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setFileError('Choose a CSV file. Excel files (.xlsx) are not supported yet — save your sheet as CSV first.');
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setFileError('Could not read that file. Try choosing it again.');
      return;
    }
    const parsed = parseStudentCsv(text);
    const classified = classifyImportRows(parsed.rows, existingRegNumbers);
    setPreview({
      fileName: file.name,
      classified,
      errors: parsed.errors,
      totalRows: parsed.rows.length + parsed.errors.length,
    });
  }

  function downloadSample() {
    const csv = toCsv(
      ['reg_number', 'name'],
      [
        ['FUD/2022/001', 'Amina Bello'],
        ['FUD/2022/002', 'Chidi Okafor'],
      ],
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'students-sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function confirmImport() {
    if (!preview || !supabase) return;
    const toAdd = preview.classified.toAdd;
    if (toAdd.length === 0) return;
    setImporting(true);
    setImportError(null);
    const { error } = await supabase.from('course_students').insert(
      toAdd.map((row) => ({
        course_id: courseId,
        reg_number: row.regNumber,
        student_name: row.name,
      })),
    );
    setImporting(false);
    if (error) {
      // The unique constraint is the backstop: a 23505 means some
      // rows were already added (e.g. in another tab). The list is
      // refreshed and the lecturer sees the plain result.
      if ((error as { code?: string }).code === '23505') {
        setImportError('Some of these students were already on the list. The list below is up to date.');
        onImported(0);
        setPreview(null);
        return;
      }
      setImportError(error.message || 'Could not save the students. Try again.');
      return;
    }
    const added = toAdd.length;
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
    onImported(added);
  }

  const { toAdd, alreadyInCourse, duplicatesInFile } = preview?.classified ?? {
    toAdd: [],
    alreadyInCourse: [],
    duplicatesInFile: [],
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="student-csv-file">
          Choose a CSV file
        </label>
        <Input
          id="student-csv-file"
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => void onFileChosen(e.target.files?.[0])}
          className="max-w-xs"
        />
        <Button type="button" variant="secondary" onClick={downloadSample}>
          Sample CSV
        </Button>
      </div>
      <p className="text-[13px] text-muted">
        CSV only, with a <span className="font-medium text-ink">reg_number</span> column and an
        optional <span className="font-medium text-ink">name</span> column. Excel files (.xlsx)
        are not supported yet — save your sheet as CSV first.
      </p>
      {fileError ? <p className="text-[13px] text-danger">{fileError}</p> : null}
      {importError ? <p className="text-[13px] text-danger">{importError}</p> : null}

      {preview ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-canvas p-4">
          <p className="text-sm font-medium text-ink">
            Preview — {preview.fileName} ({preview.totalRows} row
            {preview.totalRows === 1 ? '' : 's'})
          </p>
          <ul className="flex flex-col gap-1 text-[13px] text-muted">
            <li>
              <span className="font-medium text-ink">{toAdd.length}</span> new student
              {toAdd.length === 1 ? '' : 's'} will be added.
            </li>
            {alreadyInCourse.length > 0 ? (
              <li>
                <span className="font-medium text-ink">{alreadyInCourse.length}</span> already
                on this course&apos;s list — skipped:{' '}
                {alreadyInCourse
                  .slice(0, 5)
                  .map((r) => r.regNumber)
                  .join(', ')}
                {alreadyInCourse.length > 5
                  ? ` and ${alreadyInCourse.length - 5} more`
                  : ''}
                .
              </li>
            ) : null}
            {duplicatesInFile.length > 0 ? (
              <li>
                <span className="font-medium text-ink">{duplicatesInFile.length}</span> repeated
                inside the file — skipped:{' '}
                {duplicatesInFile
                  .slice(0, 5)
                  .map((r) => r.regNumber)
                  .join(', ')}
                {duplicatesInFile.length > 5
                  ? ` and ${duplicatesInFile.length - 5} more`
                  : ''}
                .
              </li>
            ) : null}
            {preview.errors.length > 0 ? (
              <li>
                <span className="font-medium text-ink">{preview.errors.length}</span> row
                {preview.errors.length === 1 ? '' : 's'} with problems — skipped:
                <ul className="mt-1 flex flex-col gap-0.5">
                  {preview.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>
                      Line {e.line}: {e.message}
                    </li>
                  ))}
                  {preview.errors.length > 5 ? (
                    <li>and {preview.errors.length - 5} more.</li>
                  ) : null}
                </ul>
              </li>
            ) : null}
          </ul>
          {toAdd.length > 0 ? (
            <div className="flex flex-col gap-1 text-[13px] text-muted">
              <p className="font-medium text-ink">Will be added:</p>
              {toAdd.slice(0, 10).map((r) => (
                <p key={r.regNumber}>
                  {r.regNumber}
                  {r.name ? ` — ${r.name}` : ''}
                </p>
              ))}
              {toAdd.length > 10 ? <p>and {toAdd.length - 10} more.</p> : null}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={toAdd.length === 0 || importing}
              onClick={() => void confirmImport()}
            >
              {importing
                ? 'Importing…'
                : `Import ${toAdd.length} student${toAdd.length === 1 ? '' : 's'}`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={importing}
              onClick={() => {
                setPreview(null);
                if (fileRef.current) fileRef.current.value = '';
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
