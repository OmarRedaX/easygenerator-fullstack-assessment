import { Navigate, Outlet, useLocation } from 'react-router';
import { Splash } from '../../components/ui/Splash';
import { useSession } from './session';

/** Layout route for pages that need a session. `data === null` means signed out (a normal answer, not an error). */
export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  // A known value wins even if a later recheck failed: the visitor keeps the page they already have.
  if (session.data === null) {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }
  if (session.data !== undefined) return <Outlet />;
  if (session.isError) {
    return (
      <Splash
        error
        onRetry={() => {
          void session.refetch();
        }}
      />
    );
  }
  return <Splash />;
}
