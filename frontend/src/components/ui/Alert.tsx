import type { ReactNode } from 'react';

interface AlertProps {
  children: ReactNode;
  /** Shown as "Reference <id>" only when the server supplied one. */
  requestId?: string | undefined;
}

export function Alert({ children, requestId }: AlertProps) {
  return (
    <div role="alert" className="animate-fade mb-4 flex gap-2.5 rounded-field bg-danger-bg px-3.5 py-3 text-sm leading-snug text-danger">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="mt-px size-[18px] flex-none fill-none stroke-current"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.01" />
      </svg>
      <div>
        {children}
        {requestId && <small className="mt-0.5 block text-xs tabular-nums">Reference {requestId}</small>}
      </div>
    </div>
  );
}
