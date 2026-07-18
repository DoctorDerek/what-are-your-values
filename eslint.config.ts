import type { ESLint, Linter } from "eslint"
import gitignore from "eslint-config-flat-gitignore"
import nextConfig from "eslint-config-next"
import eslintConfigPrettier from "eslint-config-prettier/flat"
import onlyWarn from "eslint-plugin-only-warn"

const eslintConfig: Linter.Config[] = [
  gitignore(),
  ...nextConfig,
  {
    plugins: {
      "only-warn": onlyWarn as unknown as ESLint.Plugin,
    },
    settings: {
      next: {
        rootDir: "apps/web/",
      },
    },
  },
  eslintConfigPrettier,
]

export default eslintConfig
