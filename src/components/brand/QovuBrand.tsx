import { cn } from '@/lib/utils';

/**
 * Qovu brand lockup (v0.6.0): the Q mark (`/favicon.svg`, single
 * source of truth for the mark geometry) plus the "Qovu" wordmark
 * in the system font. Ink text, one accent-blue dot inside the
 * mark, nothing else — per docs/DESIGN_SYSTEM.md.
 */
export function QovuBrand({
  markSize = 24,
  textClassName,
  className,
}: {
  markSize?: number;
  textClassName?: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <img
        src="/favicon.svg"
        alt=""
        aria-hidden="true"
        width={markSize}
        height={markSize}
        className="shrink-0"
      />
      <span className={cn('font-semibold tracking-tight text-ink', textClassName)}>Qovu</span>
    </span>
  );
}
