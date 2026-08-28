module.exports = {
  preset: "jest-expo",
  clearMocks: true,
  restoreMocks: true,
  testMatch: ["<rootDir>/components/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@rn-primitives|unicode-case-folding))",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "<rootDir>/components/**/*.{ts,tsx}",
    "!<rootDir>/components/**/*.test.tsx",
  ],
  coverageDirectory: "<rootDir>/../../coverage/native",
  coverageReporters: ["lcov", "text"],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
}
