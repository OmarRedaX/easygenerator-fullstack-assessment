import axe from 'axe-core';

/**
 * Fails when axe finds any violation in the rendered container. jsdom has no layout, so the colour-contrast
 * rule cannot run here; contrast is covered by the token test in src/styles/tokens.test.ts.
 */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  if (results.violations.length > 0) {
    const report = results.violations
      .map((v) => `${v.id}: ${v.help}\n${v.nodes.map((n) => `  ${n.html}`).join('\n')}`)
      .join('\n');
    throw new Error(`Accessibility violations:\n${report}`);
  }
}
