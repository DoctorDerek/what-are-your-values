import { type Config } from "prettier"

const config: Config = {
  semi: false,
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./apps/web/app/globals.css",
  tailwindAttributes: ["tw"],
  tailwindFunctions: ["tw", "classNames"],
}

export default config
