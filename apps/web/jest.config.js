/** @type {import('jest').Config} */
export default {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx)', '**/*.(test|spec).(ts|tsx)'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: { react: { runtime: 'automatic' } },
          target: 'es2022',
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(svg|png|jpg|jpeg|webp|gif)$': '<rootDir>/src/test/fileMock.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@norte/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
  },
  setupFiles: ['<rootDir>/src/test/setupEnv.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/main.tsx',
    '!src/App.tsx',
    '!src/vite-env.d.ts',
    '!src/test/**',
    '!src/**/*.module.css',
    '!src/**/*.test.{ts,tsx}',
    '!src/__tests__/**',
    '!src/copy.ts',
    '!src/pages/**',
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  clearMocks: true,
  maxWorkers: 1,
};
