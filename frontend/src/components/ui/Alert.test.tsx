import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../test/a11y';
import { Alert } from './Alert';
import { Logo } from './Logo';
import { Spinner } from './Spinner';
import { Splash } from './Splash';

describe('Alert', () => {
  it('is an alert with the message', () => {
    render(<Alert>Invalid email or password.</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.');
  });

  it('shows a reference only when a request id is given', () => {
    const { rerender } = render(<Alert>Oops</Alert>);
    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
    rerender(<Alert requestId="3f9a1c7e-2b4d">Oops</Alert>);
    expect(screen.getByText('Reference 3f9a1c7e-2b4d')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Alert requestId="abc12345">Something went wrong. Try again.</Alert>);
    await expectNoA11yViolations(container);
  });
});

describe('Splash', () => {
  it('is a status region with visually hidden loading text', () => {
    render(<Splash />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('shows the error state with Retry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<Splash error onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't reach the server.");
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations in both states', async () => {
    const { container, rerender } = render(<Splash />);
    await expectNoA11yViolations(container);
    rerender(<Splash error onRetry={() => undefined} />);
    await expectNoA11yViolations(container);
  });
});

describe('decorative parts', () => {
  it('Logo and Spinner are hidden from assistive technology', () => {
    const { container } = render(
      <>
        <Logo />
        <Spinner />
      </>,
    );
    for (const element of Array.from(container.children)) {
      expect(element).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
