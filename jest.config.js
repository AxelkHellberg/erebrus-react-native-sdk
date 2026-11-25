module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  transform: { '^.+\\.[jt]sx?$': '<rootDir>/__tests__/typescript-transformer.js' },
};
