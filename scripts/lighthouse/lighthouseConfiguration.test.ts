import { describe, expect, it } from "vitest"
import { getLighthouseCollectionConfiguration } from "./lighthouseConfiguration"

describe("Lighthouse configuration", () => {
  it("uses the five-run mobile Production defaults", () => {
    expect(getLighthouseCollectionConfiguration({})).toEqual({
      numberOfRuns: 5,
      outputDirectory: "./lighthouse-results",
      targetUrl: "https://www.whatareyourvaluesmapache.com/",
    })
  })

  it("configures authenticated target overrides without hardcoding credentials", () => {
    expect(
      getLighthouseCollectionConfiguration({
        LIGHTHOUSE_TARGET_URL: "https://target.example.com",
        LIGHTHOUSE_NUMBER_OF_RUNS: "3",
        LIGHTHOUSE_OUTPUT_DIRECTORY: "./target-results",
        LIGHTHOUSE_VERCEL_TRUSTED_OIDC_TOKEN: "short-lived-token",
      }),
    ).toEqual({
      extraHeaders: {
        "x-vercel-trusted-oidc-idp-token": "short-lived-token",
      },
      numberOfRuns: 3,
      outputDirectory: "./target-results",
      targetUrl: "https://target.example.com",
    })
  })

  it("rejects invalid run counts", () => {
    expect(() =>
      getLighthouseCollectionConfiguration({
        LIGHTHOUSE_NUMBER_OF_RUNS: "0",
      }),
    ).toThrow("must be a positive integer")
  })
})
