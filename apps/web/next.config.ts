import { withSerwist } from "@serwist/turbopack"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  transpilePackages: ["@game/data", "@game/utils", "@game/machines"],
  env: {
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA ?? "development",
  },
}

export default withSerwist(nextConfig)
