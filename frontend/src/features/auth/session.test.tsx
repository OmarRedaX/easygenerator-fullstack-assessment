import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMeOrNull } from '../../lib/api/auth';
import { ApiError, NetworkError } from '../../lib/api/errors';
import type { User } from '../../lib/api/types';
import { createTestQueryClient } from '../../test/render';
import { SESSION_KEY, useClearSession, useRecheckSession, useSession, useStartSession } from './session';

vi.mock('../../lib/api/auth', () => ({ getMeOrNull: vi.fn() }));
const getMeOrNullMock = vi.mocked(getMeOrNull);

const user: User = { id: '1', email: 'ada@example.com', name: 'Ada', createdAt: '2026-10-16T10:00:00.000Z' };
const newUser: User = { ...user, id: '2', email: 'new@example.com' };

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  getMeOrNullMock.mockReset();
});

describe('useSession', () => {
  it('uses the shared ["me"] key', () => {
    expect(SESSION_KEY).toEqual(['me']);
  });

  it('returns the signed-in user', async () => {
    getMeOrNullMock.mockResolvedValue(user);
    const { result } = renderHook(() => useSession(), { wrapper: wrapperFor(createTestQueryClient()) });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => {
      expect(result.current.data).toEqual(user);
    });
  });

  it('treats null (a 401) as a normal result and asks the server only once', async () => {
    getMeOrNullMock.mockResolvedValue(null);
    // A client with the library defaults would retry failures; the hook itself must disable retries.
    const client = new QueryClient();
    const { result } = renderHook(() => useSession(), { wrapper: wrapperFor(client) });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
    expect(getMeOrNullMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry real failures and exposes them as an error', async () => {
    getMeOrNullMock.mockRejectedValue(new ApiError(500, 'boom'));
    const { result } = renderHook(() => useSession(), { wrapper: wrapperFor(new QueryClient()) });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(getMeOrNullMock).toHaveBeenCalledTimes(1);
  });

  it('does not refetch on window focus', async () => {
    getMeOrNullMock.mockResolvedValue(user);
    const client = new QueryClient();
    const { result } = renderHook(() => useSession(), { wrapper: wrapperFor(client) });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getMeOrNullMock).toHaveBeenCalledTimes(1);
  });
});

describe('useStartSession', () => {
  it('cancels the pending check before it records the new session', async () => {
    const client = createTestQueryClient();
    const cancel = vi.spyOn(client, 'cancelQueries');
    const set = vi.spyOn(client, 'setQueryData');
    const { result } = renderHook(() => useStartSession(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await result.current(user);
    });
    expect(cancel).toHaveBeenCalledWith({ queryKey: SESSION_KEY });
    expect(set).toHaveBeenCalledWith(SESSION_KEY, user);
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(set.mock.invocationCallOrder[0] ?? 0);
  });

  // getMeOrNull maps a 401 to null, so a late "null" is what a stale 401 looks like to the cache (FR-013).
  it('a late "null" result (a stale 401) from an older session check cannot discard the new session', async () => {
    const client = createTestQueryClient();
    let resolveOldCheck: (value: User | null) => void = () => undefined;
    getMeOrNullMock.mockImplementation(
      () =>
        new Promise<User | null>((resolve) => {
          resolveOldCheck = resolve;
        }),
    );
    const { result } = renderHook(() => ({ session: useSession(), start: useStartSession() }), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => {
      expect(getMeOrNullMock).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await result.current.start(newUser);
    });
    await act(async () => {
      resolveOldCheck(null);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(client.getQueryData(SESSION_KEY)).toEqual(newUser);
  });
});

describe('useClearSession / useRecheckSession', () => {
  it('clear sets the session to null', () => {
    const client = createTestQueryClient();
    client.setQueryData(SESSION_KEY, user);
    const { result } = renderHook(() => useClearSession(), { wrapper: wrapperFor(client) });
    act(() => {
      result.current();
    });
    expect(client.getQueryData(SESSION_KEY)).toBeNull();
  });

  it('recheck invalidates the session query without clearing it', async () => {
    const client = createTestQueryClient();
    client.setQueryData(SESSION_KEY, user);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useRecheckSession(), { wrapper: wrapperFor(client) });
    await act(async () => {
      await result.current();
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: SESSION_KEY });
    expect(client.getQueryData(SESSION_KEY)).toEqual(user);
  });

  it('keeps the previous value when the recheck itself fails with a network error', async () => {
    getMeOrNullMock.mockRejectedValue(new NetworkError());
    const client = createTestQueryClient();
    client.setQueryData(SESSION_KEY, user);
    const { result } = renderHook(() => ({ session: useSession(), recheck: useRecheckSession() }), {
      wrapper: wrapperFor(client),
    });
    await act(async () => {
      await result.current.recheck();
    });
    expect(client.getQueryData(SESSION_KEY)).toEqual(user);
  });
});
