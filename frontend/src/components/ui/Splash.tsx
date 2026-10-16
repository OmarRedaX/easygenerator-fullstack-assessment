import { Button } from './Button';
import { Logo } from './Logo';

interface SplashProps {
  error?: boolean;
  onRetry?: () => void;
}

/** Full-screen state shown while the first session check is pending, or when it failed for a non-401 reason. */
export function Splash({ error = false, onRetry }: SplashProps) {
  return (
    <main className="grid min-h-svh place-items-center px-6">
      {error ? (
        <div role="alert" className="flex max-w-xs flex-col items-center gap-4 text-center">
          <Logo />
          <p className="text-[17px]">Couldn&apos;t reach the server.</p>
          <Button onClick={onRetry} className="max-w-40">
            Retry
          </Button>
        </div>
      ) : (
        <div role="status" className="animate-pulse-soft">
          <Logo />
          <span className="sr-only">Loading</span>
        </div>
      )}
    </main>
  );
}
