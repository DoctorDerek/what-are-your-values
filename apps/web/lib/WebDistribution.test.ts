import { describe, expect, it } from "vitest"
import {
  CANONICAL_WEB_ORIGIN,
  CANONICAL_WEB_ROOT_URL,
  isCanonicalProductionDeployment,
  SHIPPED_ENGLISH_WEB_PATH,
} from "@/lib/WebDistribution"

const NON_PRODUCTION_VERCEL_ENVIRONMENTS = Object.freeze([
  "preview",
  "development",
  undefined,
  "",
  "Production",
  "staging",
] as const)

describe("web distribution", () => {
  it("owns one exact canonical English production URL", () => {
    expect(CANONICAL_WEB_ORIGIN).toBe(
      "https://www.whatareyourvaluesmapache.com",
    )
    expect(SHIPPED_ENGLISH_WEB_PATH).toBe("/")
    expect(CANONICAL_WEB_ROOT_URL).toBe(
      "https://www.whatareyourvaluesmapache.com/",
    )

    const canonicalUrl = new URL(CANONICAL_WEB_ROOT_URL)
    expect(canonicalUrl.protocol).toBe("https:")
    expect(canonicalUrl.hostname).toBe("www.whatareyourvaluesmapache.com")
    expect(canonicalUrl.pathname).toBe("/")
    expect(canonicalUrl.username).toBe("")
    expect(canonicalUrl.password).toBe("")
    expect(canonicalUrl.port).toBe("")
    expect(canonicalUrl.search).toBe("")
    expect(canonicalUrl.hash).toBe("")
  })

  it("permits indexing only on the canonical production environment", () => {
    expect(isCanonicalProductionDeployment("production")).toBe(true)

    for (const environment of NON_PRODUCTION_VERCEL_ENVIRONMENTS) {
      expect(isCanonicalProductionDeployment(environment)).toBe(false)
    }
  })
})
