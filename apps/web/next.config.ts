import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@wayvm/shared"],
}

export default nextConfig
