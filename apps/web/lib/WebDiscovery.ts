import type { MetadataRoute } from "next"
import {
  CANONICAL_WEB_ORIGIN,
  CANONICAL_WEB_ROOT_URL,
  isCanonicalProductionDeployment,
} from "@/lib/WebDistribution"

const CANONICAL_WEB_SITEMAP_URL = `${CANONICAL_WEB_ORIGIN}/sitemap.xml` as const

export function createRobotsMetadata(vercelEnvironment: string | undefined) {
  if (!isCanonicalProductionDeployment(vercelEnvironment))
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    } satisfies MetadataRoute.Robots

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: CANONICAL_WEB_SITEMAP_URL,
    host: CANONICAL_WEB_ORIGIN,
  } satisfies MetadataRoute.Robots
}

export function createSitemapMetadata() {
  return [
    {
      url: CANONICAL_WEB_ROOT_URL,
    },
  ] satisfies MetadataRoute.Sitemap
}
