import { describe, expect, it } from "vitest"
import {
  createWebMetadata,
  WEB_METADATA_DESCRIPTION,
  WEB_METADATA_TITLE,
} from "@/lib/WebMetadata"

const NON_PRODUCTION_VERCEL_ENVIRONMENTS = Object.freeze([
  "preview",
  "development",
  undefined,
  "staging",
] as const)

describe("web metadata", () => {
  it("publishes the exact canonical English identity in production", () => {
    expect(createWebMetadata("production")).toEqual({
      metadataBase: new URL("https://www.whatareyourvaluesmapache.com/"),
      title:
        "What Are Your Values, Mapache? A Free Game To Find What You Value in Life",
      description:
        "What Are Your Values, Mapache? is a fast-paced, value-sorting autobattler to help you find out what you value in life.",
      alternates: {
        canonical: "https://www.whatareyourvaluesmapache.com/",
        languages: {
          en: "https://www.whatareyourvaluesmapache.com/",
          "x-default": "https://www.whatareyourvaluesmapache.com/",
        },
      },
      robots: {
        index: true,
        follow: true,
      },
      openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://www.whatareyourvaluesmapache.com/",
        siteName: "What Are Your Values, Mapache?",
        title: WEB_METADATA_TITLE,
        description: WEB_METADATA_DESCRIPTION,
      },
      twitter: {
        card: "summary",
        title: WEB_METADATA_TITLE,
        description: WEB_METADATA_DESCRIPTION,
      },
    })
  })

  it("preserves canonical identity while refusing non-production indexing", () => {
    const { robots: productionRobots, ...canonicalIdentity } =
      createWebMetadata("production")

    expect(productionRobots).toEqual({ index: true, follow: true })

    for (const environment of NON_PRODUCTION_VERCEL_ENVIRONMENTS) {
      const { robots, ...nonProductionIdentity } =
        createWebMetadata(environment)

      expect(robots).toEqual({ index: false, follow: false })
      expect(nonProductionIdentity).toEqual(canonicalIdentity)
    }
  })
})
