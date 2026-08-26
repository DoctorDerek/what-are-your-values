import { describe, expect, it } from "vitest"
import { createRobotsMetadata, createSitemapMetadata } from "@/lib/WebDiscovery"

const NON_PRODUCTION_VERCEL_ENVIRONMENTS = Object.freeze([
  "preview",
  "development",
  undefined,
  "",
  "staging",
] as const)

describe("web crawler discovery", () => {
  it("publishes canonical crawler discovery only in production", () => {
    expect(createRobotsMetadata("production")).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
      },
      sitemap: "https://whatareyourvaluesmapache.com/sitemap.xml",
      host: "https://whatareyourvaluesmapache.com",
    })
  })

  it("blocks every non-production deployment without advertising it", () => {
    for (const environment of NON_PRODUCTION_VERCEL_ENVIRONMENTS) {
      expect(createRobotsMetadata(environment)).toEqual({
        rules: {
          userAgent: "*",
          disallow: "/",
        },
      })
    }
  })

  it("publishes only the shipped English canonical route", () => {
    expect(createSitemapMetadata()).toEqual([
      {
        url: "https://whatareyourvaluesmapache.com/",
      },
    ])
  })
})
