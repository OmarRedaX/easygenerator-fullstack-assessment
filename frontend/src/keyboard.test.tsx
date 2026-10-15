import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes, createAppQueryClient } from './App';
import { SESSION_KEY } from './features/auth/session';
import { getMeOrNull, logout, signIn, signUp } from './lib/api/auth';
import type { User } from './lib/api/types';
import { renderWithProviders } from './test/render';

vi.mock('./lib/api/auth', () => ({
  getMeOrNull: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  logout: vi.fn(),
}));

const member: User = { id: '1', email: 'ada@example.com', name: 'Ada', createdAt: '2026-10-16T10:00:00.000Z' };

function nameOf(element: Element | null): string {
  if (element instanceof HTMLInputElement) return element.labels?.[0]?.textContent ?? element.name;
  return element?.textContent.trim() ?? 'none';
}

/** Names of the focused element after each Tab press. */
async function tabOrder(user: ReturnType<typeof userEvent.setup>, presses: number): Promise<string[]> {
  const order: string[] = [];
  for (let i = 0; i < presses; i++) {
    await user.tab();
    order.push(nameOf(document.activeElement));
  }
  return order;
}

beforeEach(() => {
  vi.mocked(getMeOrNull).mockReset().mockResolvedValue(null);
  vi.mocked(signIn).mockReset();
  vi.mocked(signUp).mockReset();
  vi.mocked(logout).mockReset();
});

describe('keyboard: sign-up', () => {
  it('tabs through Name, Email, Password, Show, Create account, Sign in link in that order', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/signup', client: createAppQueryClient() });
    await screen.findByRole('heading', { level: 1, name: 'Create your account' });
    expect(await tabOrder(user, 6)).toEqual([
      'Name',
      'Email',
      'Password',
      'ShowShow password',
      'Create account',
      'Sign in',
    ]);
  });

  it('Enter in any field submits exactly once', async () => {
    vi.mocked(signUp).mockResolvedValue(member);
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/signup', client: createAppQueryClient() });
    await user.type(await screen.findByLabelText('Name'), 'Ada{Enter}');
    expect(signUp).not.toHaveBeenCalled(); // invalid so far
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'Abcdef1!{Enter}');
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' })).toBeInTheDocument();
    expect(signUp).toHaveBeenCalledTimes(1);
  });

  it('Space and Enter toggle the password visibility and keep focus on the toggle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/signup', client: createAppQueryClient() });
    await screen.findByLabelText('Password');
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab(); // the toggle
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });
});

describe('keyboard: sign-in', () => {
  it('tabs through Email, Password, Show, Sign in, Create an account', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/signin', client: createAppQueryClient() });
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    expect(await tabOrder(user, 5)).toEqual(['Email', 'Password', 'ShowShow password', 'Sign in', 'Create an account']);
  });

  it('Enter in the password field submits', async () => {
    vi.mocked(signIn).mockResolvedValue(member);
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, { route: '/signin', client: createAppQueryClient() });
    await user.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret{Enter}');
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome to the application.' })).toBeInTheDocument();
  });
});

describe('keyboard: application page', () => {
  it('Sign out is reachable and activates with Enter', async () => {
    vi.mocked(logout).mockResolvedValue(undefined);
    const user = userEvent.setup();
    const client = createAppQueryClient();
    client.setQueryData(SESSION_KEY, member);
    renderWithProviders(<AppRoutes />, { route: '/', client });
    await user.tab();
    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });
});
