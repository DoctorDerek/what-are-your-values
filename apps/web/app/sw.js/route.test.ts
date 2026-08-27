import { describe, expect, it, vi } from "vitest"
import { dynamic, GET, revalidate } from "./route"

const { createSerwistRouteSpy, generatedServiceWorkerGetSpy } = vi.hoisted(
  () => {
    const generatedServiceWorkerGetSpy = vi.fn(
      async (
        _request: Request,
        _context: { params: Promise<{ path: string }> },
      ) => "generated worker",
    )

    return {
      generatedServiceWorkerGetSpy,
      createSerwistRouteSpy: vi.fn(() => ({
        GET: generatedServiceWorkerGetSpy,
      })),
    }
  },
)

vi.mock("@serwist/turbopack", () => ({
  createSerwistRoute: createSerwistRouteSpy,
}))

describe("service-worker route", () => {
  it("generates the revisioned application shell during static export", () => {
    expect(createSerwistRouteSpy).toHaveBeenCalledExactlyOnceWith({
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
    expect(dynamic).toBe("force-static")
    expect(revalidate).toBe(false)
  })

  it("delegates the root worker request with its deterministic file name", async () => {
    const request = new Request("https://whatareyourvaluesmapache.com/sw.js")

    await expect(GET(request)).resolves.toBe("generated worker")
    expect(generatedServiceWorkerGetSpy).toHaveBeenCalledOnce()
    const [delegatedRequest, delegatedContext] =
      generatedServiceWorkerGetSpy.mock.calls[0]

    expect(delegatedRequest).toBe(request)
    await expect(delegatedContext.params).resolves.toEqual({ path: "sw.js" })
  })
})
