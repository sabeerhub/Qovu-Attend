import { cn } from '@/lib/utils';

const DOT_COLORS: Record<string, string> = {
  draft: 'bg-faint',
  active: 'bg-accent',
  closed: 'bg-warning',
  finalized: 'bg-success',
  archived: 'bg-faint',
  verified: 'bg-success',
  manual: 'bg-accent',
  pending: 'bg-warning',
  rejected: 'bg-danger',
  suspicious: 'bg-danger',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT_COLORS[status] ?? 'bg-faint')} aria-hidden />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
