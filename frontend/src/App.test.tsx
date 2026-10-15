import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes, createAppQueryClient } from './App';
import { getMeOrNull, signIn } from './lib/api/auth';
import { request, setUnauthorizedHandler } from './lib/api/client';
import { ApiError } from './lib/api/errors';
import type { User } from './lib/api/types';
import { SESSION_KEY } from './features/auth/session';
import { renderWithProviders } from './test/render';

vi.mock('./lib/api/auth', () => ({
  getMeOrNull: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  logout: vi.fn(),
}));
const getMeOrNullMock = vi.mocked(getMeOrNull);
const signInMock = vi.mocked(signIn);

const member: User = { id: '1', email: 'ada@example.com', name: 'Ada', createdAt: '2026-10-16T10:00:00.000Z' };

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="location">{location.pathname + location.search}</output>;
}

function renderApp(route: string | { pathname: string; state?: unknown }, client = createAppQueryClient()) {
  return renderWithProviders(
    <>
      <AppRoutes />
      <LocationProbe />
    </>,
    { route, client },
  );
}

const here = () => screen.getByLabelText('location').textContent;

function hold<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  getMeOrNullMock.mockReset();
  signInMock.mockReset();
});

afterEach(() => {
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

describe('routing table', () => {
  it('/ is guarded: a signed-out visitor ends on /signin', async () => {
    getMeOrNullMock.mockResolvedValue(null);
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(here()).toBe('/signin');
    expect(getMeOrNullMock).toHaveBeenCalledTimes(1); // a 401 is a normal answer: no retry
  });

  it('/signin and /signup are for guests: a signed-in visitor is sent to /', async () => {
    getMeOrNullMock.mockResolvedValue(member);
    const first = renderApp('/signup');
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' })).toBeInTheDocument();
    expect(here()).toBe('/');
    first.unmount();
    renderApp('/signin');
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' })).toBeInTheDocument();
  });

  it('an unknown address goes to / and the guard decides', async () => {
    getMeOrNullMock.mockResolvedValue(null);
    const signedOut = renderApp('/no/such/page');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    signedOut.unmount();

    getMeOrNullMock.mockResolvedValue(member);
    renderApp('/another/missing');
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' })).toBeInTheDocument();
    expect(here()).toBe('/');
  });

  it('sets a descriptive title per page', async () => {
    getMeOrNullMock.mockResolvedValue(null);
    const user = userEvent.setup();
    renderApp('/signin');
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    await waitFor(() => {
      expect(document.title).toBe('Sign in - Easygenerator');
    });
    await user.click(screen.getByRole('link', { name: 'Create an account' }));
    await waitFor(() => {
      expect(document.title).toBe('Create account - Easygenerator');
    });
  });

  it('shows the welcome page title when signed in', async () => {
    getMeOrNullMock.mockResolvedValue(member);
    renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' });
    await waitFor(() => {
      expect(document.title).toBe('Easygenerator');
    });
  });
});

describe('session continuity', () => {
  it('a reload keeps the visitor signed in (a fresh cache asks the server)', async () => {
    getMeOrNullMock.mockResolvedValue(member);
    renderApp('/');
    expect(await screen.findByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to the application.' })).toBeInTheDocument();
  });

  it('after signing in, the visitor returns to where they were heading', async () => {
    getMeOrNullMock.mockResolvedValue(null);
    signInMock.mockResolvedValue(member);
    const user = userEvent.setup();
    renderApp('/?x=1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' })).toBeInTheDocument();
    expect(here()).toBe('/?x=1');
  });

  it('an unsafe return path falls back to /', async () => {
    getMeOrNullMock.mockResolvedValue(null);
    signInMock.mockResolvedValue(member);
    const user = userEvent.setup();
    renderApp({ pathname: '/signin', state: { from: '//evil.example' } });
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' });
    expect(here()).toBe('/');
  });

  it('mid-session expiry: a 401 from a protected request sends the visitor to /signin', async () => {
    getMeOrNullMock.mockResolvedValue(member);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized', requestId: 'req-1' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' });

    await expect(request('GET', '/something-protected')).rejects.toBeInstanceOf(ApiError);

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(here()).toBe('/signin');
  });

  it('a page restored from the back/forward cache is re-verified, so protected content is not revealed after sign-out', async () => {
    getMeOrNullMock.mockResolvedValue(member);
    renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' });
    expect(getMeOrNullMock).toHaveBeenCalledTimes(1);

    // The visitor signed out elsewhere (or earlier); the browser now restores this old page from its cache.
    getMeOrNullMock.mockResolvedValue(null);
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Welcome to the application.')).not.toBeInTheDocument();
    expect(here()).toBe('/signin');
  });

  it('a normal page show does not re-ask the server', async () => {
    getMeOrNullMock.mockResolvedValue(member);
    renderApp('/');
    await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' });
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(getMeOrNullMock).toHaveBeenCalledTimes(1);
  });

  it('a stale "not signed in" answer cannot discard a session that was just created (race)', async () => {
    const client = createAppQueryClient();
    client.setQueryData(SESSION_KEY, null);
    const staleCheck = hold<User | null>();
    getMeOrNullMock.mockReturnValue(staleCheck.promise);
    signInMock.mockResolvedValue(member);
    const user = userEvent.setup();
    renderApp('/signin', client);
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });

    // An older session check is still in flight when the visitor finishes signing in.
    void client.invalidateQueries({ queryKey: SESSION_KEY });
    await waitFor(() => {
      expect(getMeOrNullMock).toHaveBeenCalledTimes(1);
    });
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' });

    staleCheck.resolve(null);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to the application.' })).toBeInTheDocument();
    expect(client.getQueryData(SESSION_KEY)).toEqual(member);
  });
});
