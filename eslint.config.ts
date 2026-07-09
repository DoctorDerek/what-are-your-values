import gitignore from "eslint-config-flat-gitignore"
import nextConfig from "eslint-config-next"
import eslintConfigPrettier from "eslint-config-prettier/flat"
import type { Linter } from "eslint"
import onlyWarn from "eslint-plugin-only-warn"

const eslintConfig: Linter.Config[] = [
  gitignore(),
  ...nextConfig,
  {
    plugins: {
      "only-warn": onlyWarn,
    },
  },
  eslintConfigPrettier,
]

export default eslintConfig
