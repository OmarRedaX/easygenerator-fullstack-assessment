import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../App';
import { getMeOrNull, logout } from '../../lib/api/auth';
import { ApiError, NetworkError } from '../../lib/api/errors';
import type { User } from '../../lib/api/types';
import { expectNoA11yViolations } from '../../test/a11y';
import { createTestQueryClient, renderWithProviders } from '../../test/render';
import { SESSION_KEY } from '../auth/session';

vi.mock('../../lib/api/auth', () => ({
  getMeOrNull: vi.fn(),
  logout: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
}));
const logoutMock = vi.mocked(logout);
const getMeOrNullMock = vi.mocked(getMeOrNull);

const member: User = { id: '1', email: 'ada@example.com', name: 'Ada', createdAt: '2026-10-16T10:00:00.000Z' };

function renderSignedIn() {
  const client = createTestQueryClient();
  client.setQueryData(SESSION_KEY, member);
  return renderWithProviders(<AppRoutes />, { route: '/', client });
}

const signOut = () => screen.getByRole('button', { name: /^Sign out$|^Signing out\.\.\.$/ });

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<undefined>((res, rej) => {
    resolve = () => {
      res(undefined);
    };
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  logoutMock.mockReset();
  getMeOrNullMock.mockReset();
  getMeOrNullMock.mockResolvedValue(member);
});

describe('sign out: ends the session', () => {
  it('on 204 clears the session and lands on /signin', async () => {
    logoutMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { client } = renderSignedIn();
    await user.click(signOut());
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(SESSION_KEY)).toBeNull();
    expect(screen.queryByText('Welcome to the application.')).not.toBeInTheDocument();
  });

  it('on 401 (session already gone) behaves exactly like success', async () => {
    logoutMock.mockRejectedValue(new ApiError(401, 'Unauthorized'));
    const user = userEvent.setup();
    const { client } = renderSignedIn();
    await user.click(signOut());
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(client.getQueryData(SESSION_KEY)).toBeNull();
  });

  it('shows progress while pending and sends one request however often it is clicked', async () => {
    const pending = deferred();
    logoutMock.mockReturnValue(pending.promise);
    const user = userEvent.setup();
    renderSignedIn();
    await user.click(signOut());
    const busy = await screen.findByRole('button', { name: 'Signing out...' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await user.click(busy);
    await user.click(busy);
    expect(logoutMock).toHaveBeenCalledTimes(1);
    pending.resolve();
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('sign out: failures keep the visitor signed in', () => {
  it.each([
    ['403', new ApiError(403, 'Forbidden')],
    ['429', new ApiError(429, 'ThrottlerException')],
    ['500', new ApiError(500, 'boom')],
    ['network', new NetworkError()],
  ])('%s shows an error, stays on the page and rechecks the session', async (_name, error) => {
    logoutMock.mockRejectedValue(error);
    const user = userEvent.setup();
    const { client } = renderSignedIn();
    await user.click(signOut());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't sign you out. Try again.");
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to the application.' })).toBeInTheDocument();
    expect(client.getQueryData(SESSION_KEY)).toEqual(member);
    await waitFor(() => {
      expect(getMeOrNullMock).toHaveBeenCalledTimes(1);
    });
    expect(signOut()).not.toHaveAttribute('aria-busy');
  });

  it('shows a reference only when the server supplied one', async () => {
    logoutMock.mockRejectedValueOnce(new ApiError(500, 'x', { requestId: 'req-3f9a1c7e' }));
    const user = userEvent.setup();
    renderSignedIn();
    await user.click(signOut());
    expect(await screen.findByText('Reference req-3f9a1c7e')).toBeInTheDocument();
  });

  it('shows the error above the headline, clears it on the next try, and can still sign out', async () => {
    logoutMock.mockRejectedValueOnce(new ApiError(500, 'x')).mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderSignedIn();
    await user.click(signOut());
    const alert = await screen.findByRole('alert');
    const headline = screen.getByRole('heading', { level: 1 });
    expect(alert.compareDocumentPosition(headline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(signOut());
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });

  it('has no accessibility violations with the error shown', async () => {
    logoutMock.mockRejectedValue(new ApiError(500, 'x', { requestId: 'req-12345678' }));
    const user = userEvent.setup();
    const { container } = renderSignedIn();
    await user.click(signOut());
    await screen.findByRole('alert');
    await expectNoA11yViolations(container);
  });
});
