import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { logout } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/errors';
import { toFormFeedback } from './formErrors';
import { useClearSession, useRecheckSession } from './session';

interface Alerted {
  message: string;
  requestId?: string;
}

/**
 * Sign-out flow. Success, or a 401 (the session was already gone), clears the session and returns to /signin.
 * Any other failure keeps the visitor signed in, shows the error and asks the server who is signed in.
 */
export function useLogout() {
  const navigate = useNavigate();
  const clearSession = useClearSession();
  const recheckSession = useRecheckSession();
  const [pending, setPending] = useState(false);
  const [alert, setAlert] = useState<Alerted | null>(null);
  const inFlight = useRef(false);

  const signOut = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setAlert(null);
    try {
      await logout();
      clearSession();
      void navigate('/signin', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        void navigate('/signin', { replace: true });
        return;
      }
      const feedback = toFormFeedback(error, 'logout');
      if (feedback.message) {
        setAlert({ message: feedback.message, ...(feedback.requestId ? { requestId: feedback.requestId } : {}) });
      }
      void recheckSession();
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return { signOut, pending, alert };
}
