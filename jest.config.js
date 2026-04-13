module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  setupFiles: ['<rootDir>/src/Commons/setupEnv.js']
};