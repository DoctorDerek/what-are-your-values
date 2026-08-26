import { describe, expect, it } from "vitest"
import { createSitemapMetadata } from "@/lib/WebDiscovery"
import sitemap, { dynamic } from "./sitemap"

describe("sitemap route", () => {
  it("statically publishes the shipped canonical routes", () => {
    expect(dynamic).toBe("force-static")
    expect(sitemap()).toEqual(createSitemapMetadata())
  })
})
