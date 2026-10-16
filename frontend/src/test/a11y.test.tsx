import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from './a11y';

describe('expectNoA11yViolations', () => {
  it('passes for accessible markup', async () => {
    const { container } = render(<button type="button">ok</button>);
    await expect(expectNoA11yViolations(container)).resolves.toBeUndefined();
  });

  it('fails and names the rule for inaccessible markup', async () => {
    const { container } = render(<img src="x.png" />);
    await expect(expectNoA11yViolations(container)).rejects.toThrow(/image-alt/);
  });
});
