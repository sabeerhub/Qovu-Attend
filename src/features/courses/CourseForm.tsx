import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import {
  createCourse,
  hasCourseFormErrors,
  validateCourseForm,
  type CourseFormErrors,
} from '@/lib/courseForm';
import { useCourseReferenceData } from './useCourseReferenceData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';

const LEVEL_OPTIONS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const CREDIT_UNIT_OPTIONS = [1, 2, 3, 4, 5, 6];

/**
 * Lecturer course creation (v0.4.0). The lecturer picks the
 * department and semester; the course is created server-side through
 * the `create_lecturer_course` RPC, which also creates the
 * lecturer's own assignment to the course, so it appears in
 * My Courses immediately. No course or assignment row is ever
 * inserted directly from the client.
 *
 * When no departments or semesters exist yet (e.g. before the seed
 * is run), the form says so plainly instead of inventing options.
 */
export function CourseForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const reference = useCourseReferenceData();
  const [departmentId, setDepartmentId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('');
  const [creditUnit, setCreditUnit] = useState('');
  const [fieldErrors, setFieldErrors] = useState<CourseFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (reference.status === 'not-configured') {
    return (
      <EmptyState
        title="Supabase is not configured yet"
        description="Supabase is not connected yet."
      />
    );
  }
  if (reference.status === 'loading') return <LoadingState label="Loading departments…" />;
  if (reference.status === 'error') return <ErrorState message={reference.message} />;

  const { departments, semesters } = reference.data;
  if (departments.length === 0 || semesters.length === 0) {
    return (
      <EmptyState
        title="No departments or semesters yet"
        description={
          departments.length === 0
            ? 'No departments exist yet. Departments are set up by your university administrator before courses can be created.'
            : 'No semesters exist yet. Semesters are set up by your university administrator before courses can be created.'
        }
      />
    );
  }

  const semestersBySession = new Map<string, typeof semesters>();
  for (const semester of semesters) {
    const group = semestersBySession.get(semester.academicSessionName) ?? [];
    group.push(semester);
    semestersBySession.set(semester.academicSessionName, group);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const errors = validateCourseForm({
      departmentId,
      semesterId,
      code,
      title,
      level: level === '' ? null : Number(level),
      creditUnit: creditUnit === '' ? null : Number(creditUnit),
    });
    if (hasCourseFormErrors(errors)) {
      setFieldErrors(errors);
      return;
    }
    if (!supabase) {
      setError('Supabase is not configured yet.');
      return;
    }
    setLoading(true);
    const result = await createCourse(supabase, {
      departmentId,
      semesterId,
      code,
      title,
      level: Number(level),
      creditUnit: creditUnit === '' ? null : Number(creditUnit),
    });
    setLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setSuccess(`Course created — ${result.course.code} ${result.course.title}.`);
    setFieldErrors({});
    setCode('');
    setTitle('');
    setLevel('');
    setCreditUnit('');
    onCreated();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New course</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Department
            <select
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">Choose a department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                  {dept.code ? ` (${dept.code})` : ''}
                </option>
              ))}
            </select>
            {fieldErrors.departmentId ? (
              <span className="text-[13px] font-normal text-danger" role="alert">
                {fieldErrors.departmentId}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Semester
            <select
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
            >
              <option value="">Choose a semester</option>
              {[...semestersBySession.entries()].map(([sessionName, group]) => (
                <optgroup key={sessionName} label={sessionName}>
                  {group.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {fieldErrors.semesterId ? (
              <span className="text-[13px] font-normal text-danger" role="alert">
                {fieldErrors.semesterId}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Course code
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CIT 301"
              autoCapitalize="characters"
            />
            {fieldErrors.code ? (
              <span className="text-[13px] font-normal text-danger" role="alert">
                {fieldErrors.code}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Course title
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Web Technology"
            />
            {fieldErrors.title ? (
              <span className="text-[13px] font-normal text-danger" role="alert">
                {fieldErrors.title}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Level
            <select
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="">Choose a level</option>
              {LEVEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {fieldErrors.level ? (
              <span className="text-[13px] font-normal text-danger" role="alert">
                {fieldErrors.level}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Credit units
            <select
              className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
              value={creditUnit}
              onChange={(e) => setCreditUnit(e.target.value)}
            >
              <option value="">Not applicable</option>
              {CREDIT_UNIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {fieldErrors.creditUnit ? (
              <span className="text-[13px] font-normal text-danger" role="alert">
                {fieldErrors.creditUnit}
              </span>
            ) : null}
          </label>

          {error ? (
            <p className="text-[13px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-[13px] text-success" role="status">
              {success}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? 'Creating…' : 'Create course'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
