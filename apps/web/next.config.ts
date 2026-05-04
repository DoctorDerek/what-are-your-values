import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@what-are-your-values-mapache/shared", "@what-are-your-values-mapache/data", "@what-are-your-values-mapache/utils", "@what-are-your-values-mapache/machines"],
}

export default nextConfig
