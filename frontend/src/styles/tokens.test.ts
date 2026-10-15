import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tokens, type ThemeName } from './tokens';

// Tests run with the frontend workspace as cwd (npm -w frontend / vitest root).
const css = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8');

function channel(hex: string, start: number): number {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** The body of the first block that starts with `opener`, with balanced braces. */
function block(source: string, opener: string): string {
  const start = source.indexOf(opener);
  if (start === -1) return '';
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) return source.slice(source.indexOf('{', start) + 1, i);
  }
  return '';
}

const cssByTheme: Record<ThemeName, string> = {
  light: block(css, '@theme'),
  dark: block(block(css, '@media (prefers-color-scheme: dark)'), ':root'),
};

function cssVar(theme: ThemeName, name: string): string | undefined {
  const kebab = name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  return new RegExp(`--color-${kebab}:\\s*([^;]+);`).exec(cssByTheme[theme])?.[1]?.trim();
}

describe.each(['light', 'dark'] as const)('design tokens (%s)', (theme) => {
  const t = tokens[theme];

  it('are mirrored in index.css', () => {
    for (const [name, value] of Object.entries(t)) {
      expect(cssVar(theme, name), `--color-${name}`).toBe(value);
    }
  });

  it.each([
    ['text', 'page'],
    ['text', 'surface'],
    ['muted', 'surface'],
    ['muted', 'page'],
    ['muted', 'field'],
    ['danger', 'surface'],
    ['danger', 'page'],
    ['accent', 'surface'],
  ] as const)('%s on %s is at least 4.5:1', (foreground, background) => {
    expect(contrast(t[foreground], t[background])).toBeGreaterThanOrEqual(4.5);
  });

  it('white text on the primary button fill is at least 4.5:1', () => {
    expect(contrast('#ffffff', t.accentFill)).toBeGreaterThanOrEqual(4.5);
  });

  it('the met-rule dot is at least 3:1 against the surface (graphic)', () => {
    expect(contrast(t.ok, t.surface)).toBeGreaterThanOrEqual(3);
  });
});

describe('index.css', () => {
  it('keeps the primary button fill #0071e3 in dark mode (white text needs 4.5:1)', () => {
    expect(cssVar('dark', 'accent-fill')).toBe('#0071e3');
  });

  it.each([
    '@media (prefers-color-scheme: dark)',
    '@media (prefers-reduced-motion: reduce)',
    '@media (prefers-reduced-transparency: reduce)',
    '@media (prefers-contrast: more)',
  ])('declares %s', (query) => {
    expect(css).toContain(query);
  });

  it('never uses inline-style-only features that the CSP would block', () => {
    expect(css).not.toMatch(/@import\s+url\(\s*['"]?https?:/);
  });
});
