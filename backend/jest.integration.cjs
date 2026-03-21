/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/integration/**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFiles: ['<rootDir>/__tests__/helpers/loadTestEnv.cjs'],
  globalSetup: '<rootDir>/__tests__/helpers/globalSetup.ts',
  globalTeardown: '<rootDir>/__tests__/helpers/globalTeardown.ts',
  testTimeout: 15000,
  maxWorkers: 1,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          isolatedModules: true,
        },
      },
    ],
  },
};
