import type { Config } from 'jest';

const base = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
};

const config: Config = {
  testTimeout: 30000, // not honoured inside `projects` entries
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    {
      ...base,
      displayName: 'int',
      testMatch: ['<rootDir>/test/**/*.int-spec.ts'],
      setupFiles: ['<rootDir>/test/setup-env.ts'],
    },
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts', '!src/**/*.spec.ts'],
  coverageThreshold: { global: { statements: 80, branches: 80, functions: 80, lines: 80 } },
};
export default config;
