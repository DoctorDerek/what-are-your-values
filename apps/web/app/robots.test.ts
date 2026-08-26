import { afterEach, describe, expect, it, vi } from "vitest"
import { createRobotsMetadata } from "@/lib/WebDiscovery"
import robots, { dynamic } from "./robots"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("robots route", () => {
  it("statically publishes the production crawler policy", () => {
    vi.stubEnv("VERCEL_ENV", "production")

    expect(dynamic).toBe("force-static")
    expect(robots()).toEqual(createRobotsMetadata("production"))
  })

  it("statically refuses Preview indexing", () => {
    vi.stubEnv("VERCEL_ENV", "preview")

    expect(dynamic).toBe("force-static")
    expect(robots()).toEqual(createRobotsMetadata("preview"))
  })
})
