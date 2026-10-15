import type { ReactNode } from 'react';
import { Logo } from '../../components/ui/Logo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Switch link under the form ("Already have an account? Sign in"). */
  footer: ReactNode;
}

/** Centred card shared by sign-up and sign-in. Under 480px the card dissolves into the page. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <main className="grid min-h-svh place-items-center px-5 py-8">
      <div className="animate-rise w-full max-w-[380px] min-[480px]:rounded-card min-[480px]:bg-surface min-[480px]:p-8 min-[480px]:shadow-card">
        <Logo />
        <h1 className="mt-5 mb-1.5 text-[28px] leading-[1.1] font-bold tracking-display">{title}</h1>
        <p className="mb-5.5 text-[15px] leading-snug text-muted">{subtitle}</p>
        {children}
        <p className="mt-4.5 text-center text-sm text-muted">{footer}</p>
      </div>
    </main>
  );
}
