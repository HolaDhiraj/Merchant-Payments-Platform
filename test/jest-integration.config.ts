import type { Config } from 'jest';

// Integration test configuration: boots the real Nest app against PostgreSQL and Redis
// (start them with `docker compose up -d postgres redis`).
const config: Config = {
  rootDir: '..',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/support/setup-env.ts'],
  testTimeout: 30000,
};

export default config;
