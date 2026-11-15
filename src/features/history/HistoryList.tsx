import { EmptyState } from '@/components/ui/empty-state';

/**
 * Attendance History — Phase 3.
 * Permanent history, filters and detail view are not built yet.
 * This placeholder renders the empty state, never fake records.
 */
export function HistoryList() {
  return (
    <EmptyState
      title="No history yet"
      description="Completed attendance sessions will appear here, filterable by department, course, semester, week and date. History is a Phase 3 feature."
    />
  );
}
