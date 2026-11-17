import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AssignedCourse } from '@/hooks/useAssignments';
import type { CourseStudent } from '@/types/database';
import { normalizeRegistrationNumber } from '@/lib/submission';
import { STUDENTS_PAGE_SIZE, validateManualStudent } from '@/lib/students';
import { StudentImport } from './StudentImport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { StudentListSkeleton } from '@/components/ui/skeleton';

type StudentsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; students: CourseStudent[] };

/**
 * Students inside one course: the course's class list.
 *
 * A lecturer adds students one by one or imports a CSV file (with
 * a preview first — nothing is saved until confirmed). Only the
 * lecturer's own students ever load here (RLS); another lecturer's
 * class list is never visible.
 *
 * Why the list matters: once a course has students on its list, the
 * server only accepts attendance from registration numbers on that
 * list. A course with no students yet accepts any registration
 * number, exactly as before, so a lecturer who has not added
 * students is never locked out of their own hall.
 */
export function CourseStudents({
  course,
  onBack,
}: {
  course: AssignedCourse;
  onBack: () => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<StudentsState>({ status: 'loading' });
  const [page, setPage] = useState(0);
  const [regNumber, setRegNumber] = useState('');
  const [name, setName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const { data, error } = await supabase
          .from('course_students')
          .select('id, course_id, reg_number, student_name, created_at')
          .eq('course_id', course.id)
          .order('reg_number');
        if (error) throw new Error(error.message);
        if (!cancelled) {
          setState({ status: 'ready', students: (data ?? []) as CourseStudent[] });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load the students.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [course.id, refreshKey]);

  const students = state.status === 'ready' ? state.students : [];
  const existingRegNumbers = new Set(students.map((s) => s.reg_number));
  const pageCount = Math.max(1, Math.ceil(students.length / STUDENTS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStudents = students.slice(
    safePage * STUDENTS_PAGE_SIZE,
    safePage * STUDENTS_PAGE_SIZE + STUDENTS_PAGE_SIZE,
  );

  async function addStudent() {
    const validationError = validateManualStudent({ regNumber, name });
    if (validationError) {
      setFormError(validationError);
      return;
    }
    if (!supabase) return;
    setFormError(null);
    setActionError(null);
    setAdding(true);
    const { error } = await supabase.from('course_students').insert({
      course_id: course.id,
      reg_number: normalizeRegistrationNumber(regNumber),
      student_name: name.trim() === '' ? null : name.trim(),
    });
    setAdding(false);
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        setFormError('That registration number is already on this course’s list.');
        return;
      }
      setFormError(error.message || 'Could not add the student. Try again.');
      return;
    }
    setRegNumber('');
    setName('');
    setActionMessage(`Added ${normalizeRegistrationNumber(regNumber)} to the list.`);
    setPage(0);
    setRefreshKey((k) => k + 1);
  }

  async function deleteStudent(id: string) {
    if (!supabase) return;
    setActionError(null);
    setDeletingId(id);
    const { error } = await supabase.from('course_students').delete().eq('id', id);
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (error) {
      setActionError(error.message || 'Could not remove the student. Try again.');
      return;
    }
    setActionMessage('Student removed from the list.');
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button type="button" variant="ghost" onClick={onBack} className="self-start px-0">
          ← All courses
        </Button>
        <h2 className="text-[17px] font-semibold text-ink">
          {course.code} — {course.title}
        </h2>
        <p className="text-[13px] text-muted">
          {course.departmentName} · {course.semesterName} · Level {course.level}
        </p>
      </div>

      {actionMessage ? (
        <p className="text-[13px] text-success" role="status">
          {actionMessage}
        </p>
      ) : null}
      {actionError ? <p className="text-[13px] text-danger">{actionError}</p> : null}

      <section className="flex flex-col gap-4">
        <h3 className="text-[17px] font-semibold text-ink">
          Students
          {state.status === 'ready'
            ? ` (${students.length})`
            : ''}
        </h3>

        {state.status === 'loading' ? <StudentListSkeleton /> : null}
        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => setRefreshKey((k) => k + 1)} />
        ) : null}

        {state.status === 'ready' ? (
          students.length === 0 ? (
            <EmptyState
              title="No students yet"
              description="Import a CSV file or add one student below. Until this course has students on its list, any registration number can submit attendance."
            />
          ) : (
            <>
              <div className="flex flex-col">
                <div className="flex gap-4 border-b border-line py-2 text-[12px] font-medium uppercase text-muted">
                  <span className="w-1/3">Registration number</span>
                  <span className="w-1/4">Name</span>
                </div>
                {pageStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-4 border-b border-line py-3 last:border-b-0"
                  >
                    <span className="w-1/3 text-sm text-ink">{student.reg_number}</span>
                    <span className="w-1/4 text-sm text-muted">
                      {student.student_name ?? '—'}
                    </span>
                    <div className="ml-auto">
                      {confirmDeleteId === student.id ? (
                        <span className="flex gap-2">
                          <Button
                            type="button"
                            variant="danger"
                            disabled={deletingId === student.id}
                            onClick={() => void deleteStudent(student.id)}
                          >
                            {deletingId === student.id ? 'Removing…' : 'Remove'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Keep
                          </Button>
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setConfirmDeleteId(student.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {pageCount > 1 ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] text-muted">
                    Showing {safePage * STUDENTS_PAGE_SIZE + 1}–
                    {Math.min((safePage + 1) * STUDENTS_PAGE_SIZE, students.length)} of{' '}
                    {students.length}
                  </p>
                  <span className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={safePage === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={safePage >= pageCount - 1}
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    >
                      Next
                    </Button>
                  </span>
                </div>
              ) : null}
            </>
          )
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-[17px] font-semibold text-ink">Add one student</h3>
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-medium text-ink">
                Registration number
                <Input
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  placeholder="e.g. FUD/2022/001"
                  autoComplete="off"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1.5 text-[13px] font-medium text-ink">
                Name (optional)
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Amina Bello"
                  autoComplete="off"
                />
              </label>
            </div>
            {formError ? <p className="text-[13px] text-danger">{formError}</p> : null}
            <div>
              <Button type="button" disabled={adding} onClick={() => void addStudent()}>
                {adding ? 'Adding…' : 'Add student'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-[17px] font-semibold text-ink">Import from CSV</h3>
        <Card>
          <CardHeader>
            <CardTitle>Upload a class list</CardTitle>
          </CardHeader>
          <CardContent>
            <StudentImport
              courseId={course.id}
              existingRegNumbers={existingRegNumbers}
              onImported={(added) => {
                if (added > 0) {
                  setActionMessage(
                    `Added ${added} student${added === 1 ? '' : 's'} to the list.`,
                  );
                }
                setPage(0);
                setRefreshKey((k) => k + 1);
              }}
            />
          </CardContent>
        </Card>
        <p className="text-[13px] text-muted">
          Once this course has students on its list, only those registration numbers can submit
          attendance. Students not on the list will see: “This registration number is not on this
          course’s list. Ask your lecturer to add you.”
        </p>
      </section>
    </div>
  );
}
