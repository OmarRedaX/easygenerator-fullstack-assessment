import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDocumentTitle } from './useDocumentTitle';

function Page({ title }: { title: string }) {
  useDocumentTitle(title);
  return null;
}

describe('useDocumentTitle', () => {
  it('sets the title on mount and updates it when it changes', () => {
    const { rerender } = render(<Page title="Sign in - Easygenerator" />);
    expect(document.title).toBe('Sign in - Easygenerator');
    rerender(<Page title="Create account - Easygenerator" />);
    expect(document.title).toBe('Create account - Easygenerator');
  });
});
