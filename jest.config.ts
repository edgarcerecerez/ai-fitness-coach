import type { Config } from 'jest'

/**
 * Jest configuration for the AI Fitness Coach app.
 *
 * Restricts discovery to the local `src/` and root test files (excluding
 * `.claude/worktrees` agent copies and `node_modules`). Uses ts-jest for
 * TypeScript and supports the `@/*` path alias.
 */
const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/**/*.test.{ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '<rootDir>/.claude/worktrees/',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/.claude/worktrees/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          module: 'commonjs',
          target: 'ES2020',
          moduleResolution: 'node',
          allowJs: true,
          strict: false,
          skipLibCheck: true,
        },
      },
    ],
  },
}

export default config
