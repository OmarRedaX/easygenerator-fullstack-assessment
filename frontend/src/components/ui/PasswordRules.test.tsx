import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../test/a11y';
import { PasswordRules } from './PasswordRules';

const none = { length: false, letter: false, digit: false, special: false };

describe('PasswordRules', () => {
  it('lists the four requirements', () => {
    render(<PasswordRules rules={none} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      '8+ charactersnot met',
      'A letternot met',
      'A numbernot met',
      'A symbolnot met',
    ]);
  });

  it('exposes met/not met to assistive technology, not by colour alone', () => {
    render(<PasswordRules rules={{ ...none, length: true, letter: true }} />);
    const [length, letter, digit] = screen.getAllByRole('listitem');
    expect(within(length!).getByText('met')).toBeInTheDocument();
    expect(within(letter!).getByText('met')).toBeInTheDocument();
    expect(within(digit!).getByText('not met')).toBeInTheDocument();
  });

  it('updates when the rules change', () => {
    const { rerender } = render(<PasswordRules rules={none} />);
    expect(screen.queryAllByText('met')).toHaveLength(0);
    rerender(<PasswordRules rules={{ length: true, letter: true, digit: true, special: true }} />);
    expect(screen.getAllByText('met')).toHaveLength(4);
  });

  it('is a polite live region', () => {
    render(<PasswordRules rules={none} id="rules" />);
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('aria-live', 'polite');
    expect(list).toHaveAttribute('id', 'rules');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<PasswordRules rules={{ ...none, digit: true }} />);
    await expectNoA11yViolations(container);
  });
});
