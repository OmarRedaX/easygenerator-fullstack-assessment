import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getMeOrNull } from '../../lib/api/auth';
import type { User } from '../../lib/api/types';

/** The one cache entry for "who is signed in": a User, or null when signed out (a 401 is a normal answer). */
export const SESSION_KEY = ['me'] as const;

export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: getMeOrNull,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/**
 * Records a freshly created session (sign-in / sign-up). Any in-flight session check is cancelled first, so an
 * older response (for example a late 401) cannot overwrite the new session.
 */
export function useStartSession() {
  const client = useQueryClient();
  return useCallback(
    async (user: User): Promise<void> => {
      await client.cancelQueries({ queryKey: SESSION_KEY });
      client.setQueryData<User | null>(SESSION_KEY, user);
    },
    [client],
  );
}

/** Marks the visitor as signed out (logout success, logout 401, or a 401 from a protected request). */
export function useClearSession() {
  const client = useQueryClient();
  return useCallback(() => {
    client.setQueryData<User | null>(SESSION_KEY, null);
  }, [client]);
}

/** Asks the server again who is signed in, keeping the current value if the check itself fails. */
export function useRecheckSession() {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries({ queryKey: SESSION_KEY }), [client]);
}
