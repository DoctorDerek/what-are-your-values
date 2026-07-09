import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@game/data",
    "@game/utils",
    "@game/machines",
  ],
}

export default nextConfig
