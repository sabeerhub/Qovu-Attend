import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent-hover active:bg-accent-pressed',
        secondary: 'border border-line bg-surface text-ink hover:bg-canvas',
        ghost: 'text-ink hover:bg-canvas',
        danger: 'border border-danger text-danger hover:bg-canvas',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
