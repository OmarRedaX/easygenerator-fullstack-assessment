// Test-facing mirror of the colour tokens in index.css that carry a contrast requirement. tokens.test.ts asserts
// both that these values equal the CSS and that every text/background pair meets WCAG 2.x. See
// specs/001-frontend-auth/contracts/ui-tokens.md for the full table and the corrections made to the mockup.

export type ThemeName = 'light' | 'dark';

export interface ColorTokens {
  page: string;
  surface: string;
  field: string;
  text: string;
  muted: string;
  accent: string;
  accentFill: string;
  danger: string;
  ok: string;
}

export const tokens: Record<ThemeName, ColorTokens> = {
  light: {
    page: '#f5f5f7',
    surface: '#ffffff',
    field: '#ffffff',
    text: '#1d1d1f',
    muted: '#6e6e73',
    accent: '#0071e3',
    accentFill: '#0071e3',
    danger: '#d70015',
    ok: '#1d8a3a',
  },
  dark: {
    page: '#000000',
    surface: '#1c1c1e',
    field: '#2c2c2e',
    text: '#f5f5f7',
    muted: '#98989d',
    accent: '#0a84ff',
    accentFill: '#0071e3',
    danger: '#ff6961',
    ok: '#30d158',
  },
};
