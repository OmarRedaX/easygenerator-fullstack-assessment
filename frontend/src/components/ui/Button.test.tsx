import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../test/a11y';
import { Button } from './Button';

describe('Button', () => {
  it('renders a button with its label, 48px tall, type button by default', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('h-12');
    expect(button).not.toHaveAttribute('aria-busy');
  });

  it('calls onClick on click and on Enter', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    screen.getByRole('button', { name: 'Go' }).focus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('shows progress and ignores clicks while loading', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <Button loading onClick={onClick}>
        Signing in...
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Signing in...' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(container.querySelector('.animate-spin-fast')).not.toBeNull();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not submit its form while loading', async () => {
    const onSubmit = vi.fn((event: React.SubmitEvent) => {
      event.preventDefault();
    });
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="x" />
        <Button type="submit" loading>
          Wait
        </Button>
      </form>,
    );
    await user.type(screen.getByLabelText('x'), 'a{Enter}');
    await user.click(screen.getByRole('button', { name: 'Wait' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits its form when idle', async () => {
    const onSubmit = vi.fn((event: React.SubmitEvent) => {
      event.preventDefault();
    });
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Send</Button>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('supports the ghost variant', () => {
    render(<Button variant="ghost">Sign out</Button>);
    expect(screen.getByRole('button', { name: 'Sign out' })).toHaveAttribute('data-variant', 'ghost');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <>
        <Button>One</Button>
        <Button loading>Two</Button>
        <Button variant="ghost">Three</Button>
      </>,
    );
    await expectNoA11yViolations(container);
  });
});
