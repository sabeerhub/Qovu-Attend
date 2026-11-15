import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
