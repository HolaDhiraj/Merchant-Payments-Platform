import type { Config } from 'jest';

// Unit test configuration: fast, no external infrastructure required.
const config: Config = {
  rootDir: 'src',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.test.json' }],
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/../test/support/silence-logger.ts'],
  collectCoverageFrom: [
    '**/*.ts',
    '!main.ts',
    '!**/*.module.ts',
    '!infrastructure/database/migrations/**',
    '!infrastructure/database/seeds/**',
  ],
  coverageDirectory: '../coverage',
};

export default config;
