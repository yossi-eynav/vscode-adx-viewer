'use strict';

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.claude/'],
  modulePathIgnorePatterns: ['/.claude/'],
  moduleNameMapper: {
    vscode: '<rootDir>/tests/unit/__mocks__/vscode.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          strict: true,
          esModuleInterop: true,
          target: 'ES2020',
          module: 'commonjs',
          types: ['jest', 'node'],
        },
      },
    ],
  },
};
