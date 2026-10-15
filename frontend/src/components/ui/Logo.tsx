interface LogoProps {
  size?: 'sm' | 'md';
}

/** The brand mark: a shield with a check. Decorative; the product name is always next to it as text. */
export function Logo({ size = 'md' }: LogoProps) {
  const box = size === 'sm' ? 'size-7 rounded-lg' : 'size-11 rounded-xl shadow-lg shadow-accent/30';
  const icon = size === 'sm' ? 'size-4' : 'size-[22px]';
  return (
    <div
      aria-hidden="true"
      className={`grid place-items-center bg-linear-to-br from-brand-from to-brand-to ${box}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`${icon} fill-none stroke-white`}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3 4 7v5c0 4.4 3.2 8.3 8 9 4.8-.7 8-4.6 8-9V7l-8-4Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    </div>
  );
}
