import nextConfig from "eslint-config-next"
import eslintConfigPrettier from "eslint-config-prettier/flat"

const eslintConfig = [...nextConfig, eslintConfigPrettier]

export default eslintConfig
