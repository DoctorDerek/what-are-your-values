import { createSerwistRoute } from "@serwist/turbopack"

const serviceWorkerFileName = "sw.js" as const
const generatedServiceWorkerRoute = createSerwistRoute({
  additionalPrecacheEntries: [
    {
      url: "/",
      revision: process.env.VERCEL_GIT_COMMIT_SHA ?? "development",
    },
  ],
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
  esbuildOptions: {
    sourcemap: false,
  },
})

export const dynamic = "force-static"
export const revalidate = false
export const GET = (request: Request) =>
  generatedServiceWorkerRoute.GET(request, {
    params: Promise.resolve({ path: serviceWorkerFileName }),
  })
