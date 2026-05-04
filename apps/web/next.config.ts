import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@what-are-your-values-mapache/shared", "@what-are-your-values-mapache/data"],
}

export default nextConfig
