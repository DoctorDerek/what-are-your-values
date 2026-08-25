import { fileURLToPath } from "node:url"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/web", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    exclude: [
      ...configDefaults.exclude,
      "e2e/**",
      "apps/mobile/components/**/*.test.tsx",
    ],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["lcov", "text"],
      include: [
        "apps/web/{app,components,lib}/**/*.{ts,tsx}",
        "apps/web/scripts/copyServiceWorkerToStaticExport.ts",
        "apps/mobile/lib/**/*.ts",
        "packages/*/src/**/*.ts",
        "scripts/lighthouse/collectLighthouseReports.ts",
        "scripts/lighthouse/lighthouseConfiguration.ts",
        "scripts/lighthouse/prepareLighthouseReports.ts",
        "scripts/xstate-diff/**/*.ts",
      ],
      exclude: ["**/*.test.{ts,tsx}", "scripts/xstate-diff/xstateDiff.cli.ts"],
      thresholds: {
        statements: 79,
        branches: 79,
        functions: 79,
        lines: 79,
      },
    },
  },
})
