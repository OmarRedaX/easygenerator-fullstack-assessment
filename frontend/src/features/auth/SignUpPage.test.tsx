import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signUp } from '../../lib/api/auth';
import { ApiError, NetworkError } from '../../lib/api/errors';
import type { User } from '../../lib/api/types';
import { expectNoA11yViolations } from '../../test/a11y';
import { renderWithProviders } from '../../test/render';
import { SESSION_KEY } from './session';
import { SignUpPage } from './SignUpPage';

vi.mock('../../lib/api/auth', () => ({ signUp: vi.fn() }));
const signUpMock = vi.mocked(signUp);

const created: User = { id: '1', email: 'ada@example.com', name: 'Ada', createdAt: '2026-10-16T10:00:00.000Z' };

function renderPage(route: string | { pathname: string; state?: unknown } = '/signup') {
  return renderWithProviders(
    <Routes>
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/signin" element={<p>Sign in page</p>} />
      <Route path="/" element={<p>Home page</p>} />
      <Route path="/dashboard" element={<p>Dashboard page</p>} />
    </Routes>,
    { route },
  );
}

async function fillValid(user: UserEvent) {
  await user.type(screen.getByLabelText('Name'), '  Ada  ');
  await user.type(screen.getByLabelText('Email'), 'Ada@Example.com');
  await user.type(screen.getByLabelText('Password'), 'Abcdef1!');
}

const submit = () => screen.getByRole('button', { name: /^Create account$|^Creating account\.\.\.$/ });

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
  signUpMock.mockReset();
});

describe('SignUpPage: content', () => {
  it('has labelled fields with the right autocomplete, a heading, a title and a way to sign in', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveClass('min-h-11'); // 44px tap target (FR-019)
    await waitFor(() => {
      expect(document.title).toBe('Create account - Easygenerator');
    });
  });
});

describe('SignUpPage: validation feedback', () => {
  it('shows nothing before a field is left, then specific messages that update live', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Name'), 'Al');
    expect(screen.queryByText('Name must be at least 3 characters.')).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByText('Name must be at least 3 characters.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'a');
    await waitFor(() => {
      expect(screen.queryByText('Name must be at least 3 characters.')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Email'), 'ada@example');
    await user.tab();
    expect(screen.getByText('Enter a valid email address, like name@example.com.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('updates the password checklist live', async () => {
    const user = userEvent.setup();
    renderPage();
    const stateOf = (label: string) => within(screen.getByText(label).closest('li')!).getByText(/met$/).textContent;
    expect(stateOf('8+ characters')).toBe('not met');
    await user.type(screen.getByLabelText('Password'), 'abcdefgh1');
    expect(stateOf('8+ characters')).toBe('met');
    expect(stateOf('A letter')).toBe('met');
    expect(stateOf('A number')).toBe('met');
    expect(stateOf('A symbol')).toBe('not met');
    await user.type(screen.getByLabelText('Password'), '!');
    expect(stateOf('A symbol')).toBe('met');
  });

  it('describes the field with the checklist for screen readers', () => {
    renderPage();
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/8\+ characters/);
  });

  it('makes no request and focuses the first invalid field when submitting invalid data', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(submit());
    expect(signUpMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    expect(screen.getByText('Name must be at least 3 characters.')).toBeInTheDocument();
    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
  });
});

describe('SignUpPage: success', () => {
  it('sends normalised values, stores the session and goes home', async () => {
    signUpMock.mockResolvedValue(created);
    const user = userEvent.setup();
    const { client } = renderPage();
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByText('Home page')).toBeInTheDocument();
    expect(signUpMock).toHaveBeenCalledTimes(1);
    expect(signUpMock).toHaveBeenCalledWith({ email: 'ada@example.com', name: 'Ada', password: 'Abcdef1!' });
    expect(client.getQueryData(SESSION_KEY)).toEqual(created);
  });

  it('returns to a safe path the visitor was heading to', async () => {
    signUpMock.mockResolvedValue(created);
    const user = userEvent.setup();
    renderPage({ pathname: '/signup', state: { from: '/dashboard' } });
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('ignores an unsafe return path', async () => {
    signUpMock.mockResolvedValue(created);
    const user = userEvent.setup();
    renderPage({ pathname: '/signup', state: { from: '//evil.example' } });
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });

  it('submits with the Enter key', async () => {
    signUpMock.mockResolvedValue(created);
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'Abcdef1!{Enter}');
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });
});

describe('SignUpPage: server errors', () => {
  it('409 puts the message on the email field, keeps values and focuses the email', async () => {
    signUpMock.mockRejectedValue(new ApiError(409, 'Email already registered'));
    const user = userEvent.setup();
    renderPage();
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByText('That email is already registered.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(screen.getByLabelText('Name')).toHaveValue('  Ada  ');
    expect(screen.getByLabelText('Password')).toHaveValue('Abcdef1!');
    expect(screen.queryByText('Home page')).not.toBeInTheDocument();
  });

  it('400 with details maps known fields and shows unknown ones in the alert', async () => {
    signUpMock.mockRejectedValue(
      new ApiError(400, 'Validation failed', {
        details: [
          { field: 'password', messages: ['Password is too common.'] },
          { field: 'nickname', messages: ['is not allowed'] },
        ],
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByText('Password is too common.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(screen.getByText('nickname: is not allowed')).toBeInTheDocument();
  });

  it.each([
    ['429', new ApiError(429, 'ThrottlerException'), 'Too many attempts. Try again in a minute.'],
    ['403', new ApiError(403, 'Forbidden'), 'This request was blocked. Reload the page and try again.'],
    ['500', new ApiError(500, 'stack trace'), 'Something went wrong. Try again.'],
    ['network', new NetworkError(), 'Something went wrong. Try again.'],
  ])('%s shows a calm message in an alert', async (_name, error, text) => {
    signUpMock.mockRejectedValue(error);
    const user = userEvent.setup();
    renderPage();
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.queryByText('stack trace')).not.toBeInTheDocument();
    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('  Ada  ');
  });

  it('shows the request reference only when the server supplied one', async () => {
    signUpMock.mockRejectedValue(new ApiError(500, 'x', { requestId: 'req-3f9a1c7e' }));
    const user = userEvent.setup();
    renderPage();
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByText('Reference req-3f9a1c7e')).toBeInTheDocument();
  });
});

describe('SignUpPage: pending state', () => {
  it('locks the form, shows progress, and sends one request however often it is triggered', async () => {
    const pending = deferred<User>();
    signUpMock.mockReturnValue(pending.promise);
    const user = userEvent.setup();
    renderPage();
    await fillValid(user);
    await user.click(submit());

    const busy = await screen.findByRole('button', { name: 'Creating account...' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Name')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Password')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();

    await user.click(busy);
    await user.type(screen.getByLabelText('Password'), '{Enter}');
    expect(signUpMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Name')).toHaveValue('  Ada  ');

    pending.reject(new ApiError(500, 'x'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).not.toHaveAttribute('aria-busy');
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('readonly');
  });

  it('clears the previous server message when the visitor tries again', async () => {
    signUpMock.mockRejectedValueOnce(new ApiError(429, 'x')).mockResolvedValueOnce(created);
    const user = userEvent.setup();
    renderPage();
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(submit());
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });
});

describe('SignUpPage: accessibility', () => {
  it('has no violations initially, with errors, with a server alert and while submitting', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await expectNoA11yViolations(container);

    await user.click(submit());
    await expectNoA11yViolations(container);

    signUpMock.mockRejectedValue(new ApiError(500, 'x', { requestId: 'req-12345678' }));
    await fillValid(user);
    await user.click(submit());
    await screen.findByText('Reference req-12345678');
    await expectNoA11yViolations(container);

    const pending = deferred<User>();
    signUpMock.mockReturnValue(pending.promise);
    await user.click(submit());
    await screen.findByRole('button', { name: 'Creating account...' });
    await expectNoA11yViolations(container);
    pending.resolve(created);
  });
});
