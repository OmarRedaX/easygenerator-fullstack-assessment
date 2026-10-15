import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { User } from '../../lib/api/types';
import { SESSION_KEY } from '../auth/session';
import { expectNoA11yViolations } from '../../test/a11y';
import { createTestQueryClient, renderWithProviders } from '../../test/render';
import { WelcomePage } from './WelcomePage';

const member: User = { id: '1', email: 'ada@example.com', name: 'Ada', createdAt: '2026-10-16T10:00:00.000Z' };

function renderSignedIn(user: User = member) {
  const client = createTestQueryClient();
  client.setQueryData(SESSION_KEY, user);
  return renderWithProviders(<WelcomePage />, { client });
}

describe('WelcomePage', () => {
  it('shows exactly "Welcome to the application." as the one h1', () => {
    renderSignedIn();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]?.textContent).toBe('Welcome to the application.');
  });

  it('shows the signed-in email and the brand', () => {
    renderSignedIn();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Easygenerator')).toBeInTheDocument();
  });

  it('offers a Sign out button', () => {
    renderSignedIn();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('sets the page title', async () => {
    renderSignedIn();
    await waitFor(() => {
      expect(document.title).toBe('Easygenerator');
    });
  });

  it('lets a very long email wrap instead of overflowing', () => {
    const long = `${'a'.repeat(60)}@${'b'.repeat(60)}.example.com`;
    renderSignedIn({ ...member, email: long });
    expect(screen.getByText(long)).toHaveClass('break-all');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderSignedIn();
    await expectNoA11yViolations(container);
  });
});
