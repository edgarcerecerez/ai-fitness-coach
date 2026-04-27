import type { Config } from 'jest'

/**
 * Minimal Jest configuration that lets us run the project's TypeScript test
 * files via ts-jest. We restrict discovery to the project's `src/` directory
 * (and root-level `middleware.test.ts`) so unrelated nested worktrees do not
 * collide with Jest's haste map.
 */
const config: Config = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  rootDir: '.',
  // Limit roots to this checkout's `src/` so unrelated nested worktrees do
  // not collide with Jest's haste map (multiple package.json with the same
  // name).
  roots: ['<rootDir>/src'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  testMatch: ['<rootDir>/src/**/*.test.(ts|tsx)'],
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
          moduleResolution: 'node',
          target: 'ES2017',
          types: ['jest', 'node'],
        },
        diagnostics: false,
      },
    ],
  },
}

export default config
