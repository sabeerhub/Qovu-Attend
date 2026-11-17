import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        // 44pt tall and 16px text on phones (v0.13.0): 16px is what
        // stops iOS Safari auto-zooming on focus. Desktop keeps
        // the 36px / 14px control.
        'h-11 w-full rounded-lg border border-line bg-surface px-3 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none md:h-9 md:text-sm',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
