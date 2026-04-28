module.exports = {
  semi: false,
  plugins: [require.resolve("prettier-plugin-tailwindcss")],
  tailwindStylesheet: "./styles/globals.css",
  tailwindAttributes: ["tw"],
  tailwindFunctions: ["tw", "classNames"],
}
