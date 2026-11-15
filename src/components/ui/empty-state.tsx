import { Button } from './button';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-line bg-surface px-6 py-10">
      <p className="text-[15px] font-medium text-ink">{title}</p>
      <p className="text-[13px] text-muted">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-10 text-[13px] text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-line bg-surface px-6 py-10">
      <p className="text-[15px] font-medium text-ink">Something went wrong</p>
      <p className="text-[13px] text-muted">{message}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
