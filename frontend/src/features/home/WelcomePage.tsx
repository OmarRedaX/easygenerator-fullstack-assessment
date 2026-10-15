import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { useDocumentTitle } from '../../components/useDocumentTitle';
import { useSession } from '../auth/session';
import { useLogout } from '../auth/useLogout';

export function WelcomePage() {
  useDocumentTitle('Easygenerator');
  const { data: user } = useSession();
  const { signOut, pending, alert } = useLogout();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="glass sticky top-0 z-10 flex h-14 items-center justify-between bg-bar px-4 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em]">
          <Logo size="sm" />
          Easygenerator
        </div>
        <Button
          variant="ghost"
          loading={pending}
          onClick={() => {
            void signOut();
          }}
        >
          {pending ? 'Signing out...' : 'Sign out'}
        </Button>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-3.5 px-6 py-10 text-center">
        {alert && (
          <div className="w-full max-w-sm text-left">
            <Alert requestId={alert.requestId}>{alert.message}</Alert>
          </div>
        )}
        {user && (
          <span className="animate-rise-late inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface py-1.5 pr-3.5 pl-2 text-sm text-muted">
            <span
              aria-hidden="true"
              className="grid size-[22px] flex-none place-items-center rounded-full bg-linear-to-br from-brand-from to-brand-to text-[11px] font-semibold text-white"
            >
              {user.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 break-all">{user.email}</span>
          </span>
        )}
        <h1 className="animate-rise max-w-[9em] text-[clamp(2.125rem,5vw,2.875rem)] leading-[1.04] font-bold tracking-hero">
          Welcome to the application.
        </h1>
        <p className="animate-rise-later max-w-[28ch] text-[15px] leading-snug text-muted">
          You&apos;re signed in. Your session stays active for up to 7 days.
        </p>
      </main>
    </div>
  );
}
