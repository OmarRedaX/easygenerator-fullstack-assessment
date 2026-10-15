import { Navigate, Outlet, useLocation } from 'react-router';
import { Splash } from '../../components/ui/Splash';
import { returnPathFromState } from './safeReturnPath';
import { useSession } from './session';

/** Layout route for sign-in and sign-up: a signed-in visitor has nothing to do here. */
export function GuestOnly() {
  const session = useSession();
  const location = useLocation();

  if (session.data === null) return <Outlet />;
  // Right after a sign-in this guard re-renders before the page's own navigation lands, so it must honour the
  // return path itself instead of forcing "/" (which would drop the page the visitor was heading to).
  if (session.data !== undefined) return <Navigate to={returnPathFromState(location.state)} replace />;
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
