module.exports = {
  preset: "jest-expo",
  clearMocks: true,
  restoreMocks: true,
  testMatch: ["<rootDir>/components/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "<rootDir>/components/**/*.{ts,tsx}",
    "!<rootDir>/components/**/*.test.tsx",
  ],
  coverageDirectory: "<rootDir>/../../coverage/native",
  coverageReporters: ["lcov", "text"],
}
