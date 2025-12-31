module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/e2e/'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  collectCoverageFrom: [
    'lib/**/*.js',
    'app/api/**/*.js',
    '!lib/prisma.js', // Database client - tested via integration
    '!lib/redis.js', // Redis client - tested via integration
    '!lib/auth.js', // NextAuth config - tested via E2E
    '!lib/logger.js', // Logger - side effects only
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
    // Critical security modules require higher coverage
    'lib/security.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'lib/validation.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'lib/errors.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'lib/rate-limiter.js': {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'lib/permissions.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  // Test naming and grouping
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.test.jsx',
  ],
  // Timeout for slow tests
  testTimeout: 10000,
  // Coverage reporters
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],
  // Verbose output for CI
  verbose: true,
};
