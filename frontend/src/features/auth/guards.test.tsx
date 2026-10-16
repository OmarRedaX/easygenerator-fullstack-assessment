import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMeOrNull } from '../../lib/api/auth';
import { ApiError } from '../../lib/api/errors';
import type { User } from '../../lib/api/types';
import { createTestQueryClient, renderWithProviders } from '../../test/render';
import { GuestOnly } from './GuestOnly';
import { RequireAuth } from './RequireAuth';
import { SESSION_KEY } from './session';

vi.mock('../../lib/api/auth', () => ({ getMeOrNull: vi.fn() }));
const getMeOrNullMock = vi.mocked(getMeOrNull);

const member: User = { id: '1', email: 'ada@example.com', name: 'Ada', createdAt: '2026-10-16T10:00:00.000Z' };

function SignInProbe() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? 'none';
  return <p>Sign in page, from: {from}</p>;
}

function Tree() {
  return (
    <Routes>
      <Route element={<RequireAuth />}>
        <Route path="/private" element={<p>Private page</p>} />
      </Route>
      <Route element={<GuestOnly />}>
        <Route path="/signin" element={<SignInProbe />} />
      </Route>
      <Route path="/" element={<p>Home page</p>} />
    </Routes>
  );
}

function hold<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  getMeOrNullMock.mockReset();
});

describe('RequireAuth', () => {
  it('shows the splash and none of the page while the session is being checked', () => {
    getMeOrNullMock.mockReturnValue(hold<User | null>().promise);
    renderWithProviders(<Tree />, { route: '/private' });
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByText('Private page')).not.toBeInTheDocument();
  });

  it('sends a signed-out visitor to /signin, remembering path and query', async () => {
    getMeOrNullMock.mockResolvedValue(null);
    renderWithProviders(<Tree />, { route: '/private?tab=2' });
    expect(await screen.findByText('Sign in page, from: /private?tab=2')).toBeInTheDocument();
    expect(getMeOrNullMock).toHaveBeenCalledTimes(1);
  });

  it('renders the page for a signed-in visitor', async () => {
    getMeOrNullMock.mockResolvedValue(member);
    renderWithProviders(<Tree />, { route: '/private' });
    expect(await screen.findByText('Private page')).toBeInTheDocument();
  });

  it('shows an error splash with Retry when the check fails for a non-401 reason', async () => {
    getMeOrNullMock.mockRejectedValueOnce(new ApiError(500, 'boom')).mockResolvedValueOnce(member);
    const user = userEvent.setup();
    renderWithProviders(<Tree />, { route: '/private' });
    expect(await screen.findByText("Couldn't reach the server.")).toBeInTheDocument();
    expect(screen.queryByText('Private page')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Private page')).toBeInTheDocument();
    expect(getMeOrNullMock).toHaveBeenCalledTimes(2);
  });

  it('keeps showing the page when a later recheck fails but the user is already known', async () => {
    getMeOrNullMock.mockRejectedValue(new ApiError(503, 'down'));
    const client = createTestQueryClient();
    client.setQueryData(SESSION_KEY, member);
    renderWithProviders(<Tree />, { route: '/private', client });
    expect(screen.getByText('Private page')).toBeInTheDocument();
    await client.invalidateQueries({ queryKey: SESSION_KEY });
    await waitFor(() => {
      expect(getMeOrNullMock).toHaveBeenCalled();
    });
    expect(screen.getByText('Private page')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't reach the server.")).not.toBeInTheDocument();
  });

  it('redirects as soon as the session is cleared (logout, expiry)', async () => {
    const client = createTestQueryClient();
    client.setQueryData(SESSION_KEY, member);
    renderWithProviders(<Tree />, { route: '/private', client });
    expect(screen.getByText('Private page')).toBeInTheDocument();
    client.setQueryData(SESSION_KEY, null);
    expect(await screen.findByText(/Sign in page/)).toBeInTheDocument();
  });
});

describe('GuestOnly', () => {
  it('shows the splash while the session is being checked', () => {
    getMeOrNullMock.mockReturnValue(hold<User | null>().promise);
    renderWithProviders(<Tree />, { route: '/signin' });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText(/Sign in page/)).not.toBeInTheDocument();
  });

  it('renders the page for a signed-out visitor', async () => {
    getMeOrNullMock.mockResolvedValue(null);
    renderWithProviders(<Tree />, { route: '/signin' });
    expect(await screen.findByText('Sign in page, from: none')).toBeInTheDocument();
  });

  it('sends a signed-in visitor to /', async () => {
    getMeOrNullMock.mockResolvedValue(member);
    renderWithProviders(<Tree />, { route: '/signin' });
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });

  it('sends a signed-in visitor back to where they were heading, not just to /', async () => {
    getMeOrNullMock.mockResolvedValue(member);
    renderWithProviders(<Tree />, { route: { pathname: '/signin', state: { from: '/private?tab=2' } } });
    expect(await screen.findByText('Private page')).toBeInTheDocument();
  });

  it('ignores an unsafe return path', async () => {
    getMeOrNullMock.mockResolvedValue(member);
    renderWithProviders(<Tree />, { route: { pathname: '/signin', state: { from: '//evil.example' } } });
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });

  it('shows the error splash with Retry on a non-401 failure', async () => {
    getMeOrNullMock.mockRejectedValue(new ApiError(500, 'boom'));
    renderWithProviders(<Tree />, { route: '/signin' });
    expect(await screen.findByText("Couldn't reach the server.")).toBeInTheDocument();
  });
});

describe('guards use replace navigation', () => {
  it('does not grow the browser history when redirecting', async () => {
    getMeOrNullMock.mockResolvedValue(null);
    window.history.pushState({}, '', '/private');
    const before = window.history.length;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <Tree />
        </BrowserRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/Sign in page/)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/signin');
    expect(window.history.length).toBe(before);
  });
});
