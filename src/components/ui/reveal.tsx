import type { ReactNode } from 'react';
import { revealClassName, useInView } from '@/lib/useInView';
import { cn } from '@/lib/utils';

/**
 * Scroll reveal wrapper (v0.8.2). Children fade in with a slight
 * rise when they scroll into view. Content is visible by default
 * (see `useInView`) — the animation only ever enhances, it never
 * hides content from anyone.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={cn(revealClassName(inView), className)}>
      {children}
    </div>
  );
}
