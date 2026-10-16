import type { ComponentPropsWithRef, MouseEvent } from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'type'> {
  variant?: 'primary' | 'ghost';
  /** Shows progress and ignores clicks (including form submission) without leaving the tab order. */
  loading?: boolean;
  type?: 'button' | 'submit';
}

const base =
  'inline-flex items-center justify-center gap-2.5 font-semibold transition-[transform,background-color,opacity] ' +
  'duration-150 ease-soft active:scale-press';

const variants = {
  primary:
    'h-12 w-full rounded-field bg-accent-fill text-[17px] tracking-[-0.01em] text-white hover:bg-accent-press',
  ghost:
    'min-h-11 rounded-full border border-line bg-transparent px-4 text-sm font-medium text-text hover:bg-text/10',
} as const;

export function Button({
  variant = 'primary',
  loading = false,
  type = 'button',
  className = '',
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...rest}
      type={type}
      data-variant={variant}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={handleClick}
      className={`${base} ${variants[variant]} ${loading ? 'cursor-progress opacity-80' : ''} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
