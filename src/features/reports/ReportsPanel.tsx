import { EmptyState } from '@/components/ui/empty-state';

/**
 * Reports & Exports — Phase 3.
 * PDF reports and CSV exports are not built yet. When they are,
 * they will run with the same permission checks as the UI and will
 * only ever export the lecturer's authorized records.
 */
export function ReportsPanel() {
  return (
    <EmptyState
      title="No reports yet"
      description="PDF reports and CSV exports will be available here in Phase 3, scoped to your authorized attendance records."
    />
  );
}
