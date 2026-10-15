import { screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signIn } from '../../lib/api/auth';
import { ApiError, NetworkError } from '../../lib/api/errors';
import type { User } from '../../lib/api/types';
import { expectNoA11yViolations } from '../../test/a11y';
import { renderWithProviders } from '../../test/render';
import { SESSION_KEY } from './session';
import { SignInPage } from './SignInPage';

vi.mock('../../lib/api/auth', () => ({ signIn: vi.fn() }));
const signInMock = vi.mocked(signIn);

const member: User = { id: '1', email: 'ada@example.com', name: 'Ada', createdAt: '2026-10-16T10:00:00.000Z' };

function renderPage(route: string | { pathname: string; state?: unknown } = '/signin') {
  return renderWithProviders(
    <Routes>
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<p>Sign up page</p>} />
      <Route path="/" element={<p>Home page</p>} />
      <Route path="/dashboard" element={<p>Dashboard page</p>} />
    </Routes>,
    { route },
  );
}

async function fill(user: UserEvent, email = 'ada@example.com', password = 'whatever') {
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
}

const submit = () => screen.getByRole('button', { name: /^Sign in$|^Signing in\.\.\.$/ });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  signInMock.mockReset();
});

describe('SignInPage: content', () => {
  it('has labelled fields, a heading, a title and a way to sign up', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup');
    await waitFor(() => {
      expect(document.title).toBe('Sign in - Easygenerator');
    });
  });

  it('does not show the password checklist (the policy is not re-applied at sign-in)', () => {
    renderPage();
    expect(screen.queryByText('8+ characters')).not.toBeInTheDocument();
  });
});

describe('SignInPage: validation', () => {
  it('checks presence only and focuses the first empty field', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(submit());
    expect(signInMock).not.toHaveBeenCalled();
    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('validates the email format after the field is left', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Email'), 'nope');
    await user.tab();
    expect(screen.getByText('Enter a valid email address, like name@example.com.')).toBeInTheDocument();
  });

  it('accepts a one-character password', async () => {
    signInMock.mockResolvedValue(member);
    const user = userEvent.setup();
    renderPage();
    await fill(user, 'ada@example.com', 'x');
    await user.click(submit());
    expect(signInMock).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'x' });
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });
});

describe('SignInPage: success', () => {
  it('stores the session and goes home', async () => {
    signInMock.mockResolvedValue(member);
    const user = userEvent.setup();
    const { client } = renderPage();
    await fill(user, 'Ada@Example.com', '  spaced secret  ');
    await user.click(submit());
    expect(await screen.findByText('Home page')).toBeInTheDocument();
    expect(signInMock).toHaveBeenCalledWith({ email: 'ada@example.com', password: '  spaced secret  ' });
    expect(client.getQueryData(SESSION_KEY)).toEqual(member);
  });

  it('returns to a safe path the visitor was heading to, and ignores an unsafe one', async () => {
    signInMock.mockResolvedValue(member);
    const user = userEvent.setup();
    renderPage({ pathname: '/signin', state: { from: '/dashboard' } });
    await fill(user);
    await user.click(submit());
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('falls back to home for an unsafe return path', async () => {
    signInMock.mockResolvedValue(member);
    const user = userEvent.setup();
    renderPage({ pathname: '/signin', state: { from: 'https://evil.example' } });
    await fill(user);
    await user.click(submit());
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });

  it('submits with the Enter key', async () => {
    signInMock.mockResolvedValue(member);
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret{Enter}');
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });
});

describe('SignInPage: errors', () => {
  it('401 shows one generic message, keeps the values and focuses the password', async () => {
    signInMock.mockRejectedValue(new ApiError(401, 'Invalid email or password', { requestId: 'req-3f9a1c7e' }));
    const user = userEvent.setup();
    renderPage();
    await fill(user, 'someone@example.com', 'wrong');
    await user.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.getByText('Reference req-3f9a1c7e')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('someone@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('wrong');
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  it('shows the same message for any email, with no reference when none was supplied', async () => {
    signInMock.mockRejectedValue(new ApiError(401, 'Invalid email or password'));
    const user = userEvent.setup();
    renderPage();
    await fill(user, 'unknown@example.com', 'x');
    await user.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
  });

  it.each([
    ['429', new ApiError(429, 'ThrottlerException'), 'Too many attempts. Try again in a minute.'],
    ['403', new ApiError(403, 'Forbidden'), 'This request was blocked. Reload the page and try again.'],
    ['500', new ApiError(500, 'stack trace'), 'Something went wrong. Try again.'],
    ['network', new NetworkError(), 'Something went wrong. Try again.'],
  ])('%s shows a calm message without a reference', async (_name, error, text) => {
    signInMock.mockRejectedValue(error);
    const user = userEvent.setup();
    renderPage();
    await fill(user);
    await user.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.queryByText('stack trace')).not.toBeInTheDocument();
    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
  });
});

describe('SignInPage: pending state', () => {
  it('locks the form, shows progress, and sends one request however often it is triggered', async () => {
    const pending = deferred<User>();
    signInMock.mockReturnValue(pending.promise);
    const user = userEvent.setup();
    renderPage();
    await fill(user);
    await user.click(submit());

    const busy = await screen.findByRole('button', { name: 'Signing in...' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Password')).toHaveAttribute('readonly');
    await user.click(busy);
    await user.type(screen.getByLabelText('Password'), '{Enter}');
    expect(signInMock).toHaveBeenCalledTimes(1);

    pending.reject(new ApiError(401, 'x'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).not.toHaveAttribute('aria-busy');
  });
});

describe('SignInPage: password visibility and accessibility', () => {
  it('can show and hide the password', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });

  it('has no violations initially, with errors, with a server alert and while submitting', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await expectNoA11yViolations(container);
    await user.click(submit());
    await expectNoA11yViolations(container);

    signInMock.mockRejectedValue(new ApiError(401, 'x', { requestId: 'req-12345678' }));
    await fill(user);
    await user.click(submit());
    await screen.findByText('Reference req-12345678');
    await expectNoA11yViolations(container);

    const pending = deferred<User>();
    signInMock.mockReturnValue(pending.promise);
    await user.click(submit());
    await screen.findByRole('button', { name: 'Signing in...' });
    await expectNoA11yViolations(container);
    pending.resolve(member);
  });
});
