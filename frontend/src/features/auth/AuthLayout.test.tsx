import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthLink } from './AuthLayout';

function Probe() {
  const state = useLocation().state as { from?: string } | null;
  return <p>Arrived, from: {state?.from ?? 'none'}</p>;
}

describe('AuthLink', () => {
  it('keeps the return path when switching between sign-in and sign-up', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/signin', state: { from: '/?x=1' } }]}>
        <Routes>
          <Route path="/signin" element={<AuthLink to="/signup">Create an account</AuthLink>} />
          <Route path="/signup" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(screen.getByText('Arrived, from: /?x=1')).toBeInTheDocument();
  });

  it('works without any router state', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/signin']}>
        <Routes>
          <Route path="/signin" element={<AuthLink to="/signup">Create an account</AuthLink>} />
          <Route path="/signup" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(screen.getByText('Arrived, from: none')).toBeInTheDocument();
  });

  it('is a 44px tap target', () => {
    render(
      <MemoryRouter>
        <AuthLink to="/signup">Create an account</AuthLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveClass('min-h-11');
  });
});
