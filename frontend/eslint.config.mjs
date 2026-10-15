import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const storageGlobals = ['localStorage', 'sessionStorage', 'indexedDB'].map((name) => ({
  name,
  message: 'Credentials, session data and user data must never be persisted in the browser (FR-017).',
}));

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  reactHooks.configs.flat['recommended-latest'],
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'no-restricted-globals': ['error', ...storageGlobals],
      'no-restricted-properties': [
        'error',
        { object: 'document', property: 'cookie', message: 'The session cookie is httpOnly; scripts never touch cookies.' },
        { object: 'window', property: 'localStorage', message: 'Do not persist data in the browser (FR-017).' },
        { object: 'window', property: 'sessionStorage', message: 'Do not persist data in the browser (FR-017).' },
        { object: 'globalThis', property: 'localStorage', message: 'Do not persist data in the browser (FR-017).' },
        { object: 'globalThis', property: 'sessionStorage', message: 'Do not persist data in the browser (FR-017).' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='style']",
          message: 'Inline styles are blocked by the production CSP. Use Tailwind utilities or tokens.',
        },
      ],
    },
  },
  {
    // lib/ is framework-free: it knows HTTP and validation, nothing about React.
    files: ['src/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react/*', 'react-dom', 'react-dom/*', 'react-router', 'react-router/*', '@tanstack/*'], message: 'src/lib must stay free of React and TanStack imports.' },
          ],
        },
      ],
    },
  },
  {
    // components/ui is presentation only: no auth, no API.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/features/**', '**/lib/api/**'], message: 'src/components/ui must not know about features or the API.' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['vite.config.ts', 'eslint.config.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
);
