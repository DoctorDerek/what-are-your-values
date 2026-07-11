import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    alias: {
      "@": path.resolve(__dirname, "./apps/web"),
    },
  },
})
