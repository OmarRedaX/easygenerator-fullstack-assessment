import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';

interface FieldProps extends ComponentPropsWithRef<'input'> {
  label: string;
  error?: string | undefined;
  /** Rendered inside the input box, on the right (the show/hide control). */
  trailing?: ReactNode;
}

export function Field({ label, error, trailing, id, className = '', 'aria-describedby': describedBy, ...rest }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const description = [describedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <div className="mb-3.5">
      <label htmlFor={inputId} className="mb-1.5 ml-0.5 block text-[13px] font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          {...rest}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={description}
          className={
            'h-12 w-full rounded-field border border-line bg-field px-3.5 text-[17px] text-text outline-hidden ' +
            'transition-[border-color,box-shadow] duration-150 ease-soft hover:border-text/40 ' +
            'focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-ring ' +
            'aria-invalid:border-danger aria-invalid:focus-visible:ring-danger-bg ' +
            `disabled:cursor-not-allowed disabled:opacity-55 ${trailing ? 'pr-20' : ''} ${className}`
          }
        />
        {trailing}
      </div>
      {error && (
        <p id={errorId} role="alert" className="animate-fade mt-1.5 ml-0.5 text-[13px] leading-snug text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
