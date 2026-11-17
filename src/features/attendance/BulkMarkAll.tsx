/**
 * "Mark all as arrived" (v0.12.0) — lecturer side, in the session
 * workspace next to the manual-add form.
 *
 * The lecturer counts everyone in the hall and has no time to add
 * students one by one. One tap marks every student on the course's
 * class list as manual attendance. The confirm step comes FIRST
 * and shows the numbers in plain words — students on the list, how
 * many already submitted (skipped), how many will be marked, and
 * the session headcount — so the lecturer sees a mismatch coming
 * before anything is saved. The server re-derives everything and
 * skips anyone who already has a record; this screen is a preview
 * only, never the decision.
 *
 * With no class list there is nobody to mark, so the button does
 * not appear at all — the screen says to add the class list first.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { bulkMarkAll } from '@/lib/edgeFunctions';
import {
  BULK_MARK_REASON,
  bulkMarkResultMessage,
  computeBulkMarkPreview,
} from '@/lib/bulkMark';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/empty-state';
import type { AttendanceRecord, AttendanceSession, CourseStudent } from '@/types/database';

export function BulkMarkAll({
  session,
  records,
  onMarked,
}: {
  session: AttendanceSession;
  records: AttendanceRecord[];
  onMarked: () => void;
}) {
  const [rosterState, setRosterState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; roster: CourseStudent[] }
  >({ status: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const loadRoster = useCallback(async () => {
    if (!supabase) return;
    setRosterState({ status: 'loading' });
    try {
      const { data, error } = await supabase
        .from('course_students')
        .select('id, course_id, reg_number, student_name, created_at')
        .eq('course_id', session.course_id)
        .order('reg_number');
      if (error) setRosterState({ status: 'error', message: error.message });
      else setRosterState({ status: 'ready', roster: (data ?? []) as CourseStudent[] });
    } catch (err: unknown) {
      setRosterState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not load the class list.',
      });
    }
  }, [session.course_id]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  async function onConfirm() {
    setBusy(true);
    const response = await bulkMarkAll(session.id, BULK_MARK_REASON);
    setBusy(false);
    setConfirming(false);
    if (!response.ok) {
      setResult({ kind: 'error', text: response.error.message });
      return;
    }
    const message = bulkMarkResultMessage(response.data);
    setResult({
      kind: 'success',
      text: response.data.warning ? `${message} ${response.data.warning}` : message,
    });
    onMarked();
  }

  if (rosterState.status === 'loading') {
    return <LoadingState label="Loading the class list…" />;
  }
  if (rosterState.status === 'error') {
    return (
      <ErrorState message={rosterState.message} onRetry={() => void loadRoster()} />
    );
  }

  const roster = rosterState.roster;
  if (roster.length === 0) {
    return (
      <EmptyState
        title="Add the class list first — there is nobody to mark"
        description="Mark all as arrived needs the course's class list. Add the students to the course first, then mark them all here."
      />
    );
  }

  const preview = computeBulkMarkPreview({
    roster,
    records,
    headcount: session.headcount,
  });

  return (
    <div className="flex max-w-md flex-col gap-4">
      <p className="text-[13px] text-muted">
        One tap marks every student on the class list as arrived — for
        when you counted everyone in the hall and have no time to add
        them one by one. Anyone who already submitted is skipped, so
        nobody is counted twice.
      </p>
      {result ? (
        <p
          className={
            result.kind === 'success'
              ? 'text-[13px] text-success'
              : 'text-[13px] text-danger'
          }
          role="status"
        >
          {result.text}
        </p>
      ) : null}
      {confirming ? (
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
          <h4 className="text-[15px] font-medium text-ink">
            Mark {preview.toMark} student{preview.toMark === 1 ? '' : 's'} as arrived?
          </h4>
          <ul className="flex flex-col gap-1 text-[13px] text-muted">
            <li>
              {preview.onList} student{preview.onList === 1 ? '' : 's'} on the class list
            </li>
            <li>
              {preview.alreadySubmitted} already submitted —{' '}
              {preview.alreadySubmitted === 1 ? 'that student will be' : 'they will be'}{' '}
              skipped
            </li>
            <li>
              {preview.toMark} will be marked as arrived
            </li>
            <li>
              Physical headcount:{' '}
              {preview.headcount === null ? 'not recorded' : String(preview.headcount)}
            </li>
          </ul>
          {preview.willExceedHeadcount ? (
            <p className="text-[13px] text-ink" role="status">
              After this, verified + manual will be more than the
              headcount of {preview.headcount} — the session will show
              the headcount review flag. This is a flag to review, not
              automatic evidence of fraud.
            </p>
          ) : null}
          <p className="text-[13px] text-muted">
            Every marked student is recorded as manual attendance with
            the reason “{BULK_MARK_REASON}”, and each one is written
            to the audit log.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || preview.toMark === 0}
              onClick={() => void onConfirm()}
            >
              {busy
                ? 'Marking…'
                : preview.toMark === 0
                  ? 'Nobody new to mark'
                  : `Mark ${preview.toMark} as arrived`}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            disabled={preview.toMark === 0}
            onClick={() => {
              setResult(null);
              setConfirming(true);
            }}
            className="self-start"
          >
            Mark all as arrived
          </Button>
          {preview.toMark === 0 ? (
            <p className="mt-2 text-[13px] text-muted">
              Everyone on the class list already has a record in this
              session — nobody new to mark.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
