import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { SignInPage } from './SignInPage';
import { SignUpPage } from './SignUpPage';

// These tests use the REAL fetch client, auth calls and error mapping and stub only `fetch`, so a mismatch between
// what the server sends (the contract's error envelope) and what a page does with it cannot hide behind a mock.

const fetchMock = vi.fn<typeof fetch>();

function envelope(status: number, body: object, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/" element={<p>Home page</p>} />
    </Routes>,
    { route },
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sign-in through the real client', () => {
  it('a 400 envelope with details for email appears on the email field', async () => {
    fetchMock.mockResolvedValue(
      envelope(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        requestId: 'req-12345678',
        details: [{ field: 'email', messages: ['email must be an email'] }],
      }),
    );
    const user = userEvent.setup();
    renderAt('/signin');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret{Enter}');
    expect(await screen.findByText('email must be an email')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/auth/signin');
    expect(init?.method).toBe('POST');
  });

  it('a 401 envelope shows the generic message and the server reference', async () => {
    fetchMock.mockResolvedValue(
      envelope(401, { statusCode: 401, error: 'Unauthorized', message: 'Invalid email or password', requestId: 'req-abcdef12' }),
    );
    const user = userEvent.setup();
    renderAt('/signin');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.getByText('Reference req-abcdef12')).toBeInTheDocument();
  });

  it('a 500 whose only reference is the X-Request-Id header still shows it, and hides the server text', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>Internal stack trace</html>', { status: 500, headers: { 'X-Request-Id': 'hdr-87654321' } }),
    );
    const user = userEvent.setup();
    renderAt('/signin');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    expect(screen.getByText('Reference hdr-87654321')).toBeInTheDocument();
    expect(screen.queryByText(/stack trace/i)).not.toBeInTheDocument();
  });
});

describe('sign-up through the real client', () => {
  it('a 409 envelope puts the duplicate-email message on the email field', async () => {
    fetchMock.mockResolvedValue(
      envelope(409, { statusCode: 409, error: 'Conflict', message: 'Email already registered', requestId: 'req-1234abcd' }),
    );
    const user = userEvent.setup();
    renderAt('/signup');
    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'Abcdef1!{Enter}');
    expect(await screen.findByText('That email is already registered.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1]?.body as string | undefined) ?? '{}') as Record<string, string>;
    expect(body).toEqual({ email: 'ada@example.com', name: 'Ada', password: 'Abcdef1!' });
  });

  it('a 201 envelope signs the visitor in and goes home', async () => {
    fetchMock.mockResolvedValue(
      envelope(201, { user: { id: '1', email: 'ada@example.com', name: 'Ada', createdAt: '2026-10-16T10:00:00.000Z' } }),
    );
    const user = userEvent.setup();
    renderAt('/signup');
    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'Abcdef1!{Enter}');
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });
});
