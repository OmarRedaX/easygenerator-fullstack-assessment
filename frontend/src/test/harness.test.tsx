import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('renders React and supports jest-dom matchers', () => {
    render(<h1>ok</h1>);
    expect(screen.getByRole('heading', { name: 'ok' })).toBeInTheDocument();
  });
});
