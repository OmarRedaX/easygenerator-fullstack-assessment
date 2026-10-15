import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes, createAppQueryClient } from './App';
import { SESSION_KEY } from './features/auth/session';
import { getMeOrNull, logout, signIn, signUp } from './lib/api/auth';
import { ApiError } from './lib/api/errors';
import type { User } from './lib/api/types';
import { expectNoA11yViolations } from './test/a11y';
import { renderWithProviders } from './test/render';

vi.mock('./lib/api/auth', () => ({
  getMeOrNull: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  logout: vi.fn(),
}));

const member: User = { id: '1', email: 'ada@example.com', name: 'Ada', createdAt: '2026-10-16T10:00:00.000Z' };

function never<T>() {
  return new Promise<T>(() => undefined);
}

/** Every page, in every state the user can see, must pass axe and expose names for all controls (SC-006). */
async function expectWellFormedPage(container: Element) {
  await expectNoA11yViolations(container);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  for (const input of screen.queryAllByRole('textbox')) expect(input).toHaveAccessibleName();
  for (const button of screen.queryAllByRole('button')) expect(button).toHaveAccessibleName();
  for (const link of screen.queryAllByRole('link')) expect(link).toHaveAccessibleName();
  expect(container.querySelectorAll('main')).toHaveLength(1);
}

beforeEach(() => {
  vi.mocked(getMeOrNull).mockReset();
  vi.mocked(signIn).mockReset();
  vi.mocked(signUp).mockReset();
  vi.mocked(logout).mockReset();
});

describe('sign-up page states', () => {
  it('initial, invalid, server error and submitting', async () => {
    vi.mocked(getMeOrNull).mockResolvedValue(null);
    const user = userEvent.setup();
    const { container } = renderWithProviders(<AppRoutes />, { route: '/signup', client: createAppQueryClient() });
    await screen.findByRole('heading', { level: 1, name: 'Create your account' });
    await expectWellFormedPage(container);

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByText('Enter your email.');
    await expectWellFormedPage(container);

    vi.mocked(signUp).mockRejectedValue(new ApiError(409, 'Email already registered'));
    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'Abcdef1!');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByText('That email is already registered.');
    await expectWellFormedPage(container);

    vi.mocked(signUp).mockReturnValue(never());
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByRole('button', { name: 'Creating account...' });
    await expectWellFormedPage(container);
  });
});

describe('sign-in page states', () => {
  it('initial, invalid, wrong credentials and submitting', async () => {
    vi.mocked(getMeOrNull).mockResolvedValue(null);
    const user = userEvent.setup();
    const { container } = renderWithProviders(<AppRoutes />, { route: '/signin', client: createAppQueryClient() });
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    await expectWellFormedPage(container);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Enter your email.');
    await expectWellFormedPage(container);

    vi.mocked(signIn).mockRejectedValue(new ApiError(401, 'x', { requestId: 'req-3f9a1c7e' }));
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Reference req-3f9a1c7e');
    await expectWellFormedPage(container);

    vi.mocked(signIn).mockReturnValue(never());
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('button', { name: 'Signing in...' });
    await expectWellFormedPage(container);
  });
});

describe('application page states', () => {
  it('signed in, signing out, and sign-out failure', async () => {
    vi.mocked(getMeOrNull).mockResolvedValue(member);
    const user = userEvent.setup();
    const client = createAppQueryClient();
    client.setQueryData(SESSION_KEY, member);
    const { container } = renderWithProviders(<AppRoutes />, { route: '/', client });
    await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' });
    await expectWellFormedPage(container);

    vi.mocked(logout).mockRejectedValueOnce(new ApiError(500, 'x', { requestId: 'req-12345678' }));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByText('Reference req-12345678');
    await expectWellFormedPage(container);

    vi.mocked(logout).mockReturnValue(never());
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('button', { name: 'Signing out...' });
    await expectWellFormedPage(container);
  });
});

describe('splash states', () => {
  it('loading and server unreachable', async () => {
    vi.mocked(getMeOrNull).mockReturnValueOnce(never());
    const first = renderWithProviders(<AppRoutes />, { route: '/', client: createAppQueryClient() });
    expect(screen.getByRole('status')).toBeInTheDocument();
    await expectNoA11yViolations(first.container);
    first.unmount();

    vi.mocked(getMeOrNull).mockRejectedValue(new ApiError(500, 'x'));
    const second = renderWithProviders(<AppRoutes />, { route: '/', client: createAppQueryClient() });
    await screen.findByText("Couldn't reach the server.");
    await expectNoA11yViolations(second.container);
  });
});
