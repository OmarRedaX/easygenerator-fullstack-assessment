import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../test/a11y';
import { Field } from './Field';
import { PasswordField } from './PasswordField';

describe('Field', () => {
  it('binds the label to the control', () => {
    render(<Field label="Email" type="email" autoComplete="email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('autocomplete', 'email');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveClass('h-12');
  });

  it('announces an error together with the field', () => {
    render(<Field label="Name" error="Name must be at least 3 characters." />);
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Name must be at least 3 characters.');
    expect(input.getAttribute('aria-describedby')).toContain(alert.id);
    expect(input).toHaveAccessibleDescription('Name must be at least 3 characters.');
  });

  it('merges an external description with the error', () => {
    render(
      <>
        <p id="rules">Rules text</p>
        <Field label="Password" error="Too short." aria-describedby="rules" />
      </>,
    );
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Rules text Too short.');
  });

  it('can be disabled', () => {
    render(<Field label="Email" disabled />);
    expect(screen.getByLabelText('Email')).toBeDisabled();
  });

  it('forwards a ref to the input', () => {
    let element: HTMLInputElement | null = null;
    render(
      <Field
        label="Email"
        ref={(node) => {
          element = node;
        }}
      />,
    );
    expect(element).toBe(screen.getByLabelText('Email'));
  });

  it('has no accessibility violations (plain and invalid)', async () => {
    const { container } = render(
      <>
        <Field label="Email" />
        <Field label="Name" error="Required." />
      </>,
    );
    await expectNoA11yViolations(container);
  });
});

describe('PasswordField', () => {
  it('hides the password by default and toggles with a named button', async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" autoComplete="new-password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'new-password');

    await user.type(input, 'secret');
    const show = screen.getByRole('button', { name: 'Show password' });
    expect(show).toHaveAttribute('aria-pressed', 'false');
    await user.click(show);

    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('secret');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('keeps focus where the user was when toggling with the keyboard', async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" />);
    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveFocus();
  });

  it('disables the toggle with the field', () => {
    render(<PasswordField label="Password" disabled />);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
  });

  it('shows errors and has no accessibility violations', async () => {
    const { container } = render(<PasswordField label="Password" error="Enter your password." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your password.');
    await expectNoA11yViolations(container);
  });
});
