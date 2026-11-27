module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  transform: { '^.+\\.tsx?$': '<rootDir>/__tests__/typescript-transformer.js' },
};
