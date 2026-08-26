import type { Metadata } from "next"
import {
  CANONICAL_WEB_ROOT_URL,
  isCanonicalProductionDeployment,
} from "@/lib/WebDistribution"

export const WEB_METADATA_TITLE =
  "What Are Your Values, Mapache? A Free Game To Find What You Value in Life" as const

export const WEB_METADATA_DESCRIPTION =
  "What Are Your Values, Mapache? is a fast-paced, value-sorting autobattler to help you find out what you value in life." as const

const SHIPPED_LANGUAGE_ALTERNATES = Object.freeze({
  en: CANONICAL_WEB_ROOT_URL,
  "x-default": CANONICAL_WEB_ROOT_URL,
} as const)

export function createWebMetadata(vercelEnvironment: string | undefined) {
  const indexingIsPermitted = isCanonicalProductionDeployment(vercelEnvironment)

  return {
    metadataBase: new URL(CANONICAL_WEB_ROOT_URL),
    title: WEB_METADATA_TITLE,
    description: WEB_METADATA_DESCRIPTION,
    alternates: {
      canonical: CANONICAL_WEB_ROOT_URL,
      languages: SHIPPED_LANGUAGE_ALTERNATES,
    },
    robots: {
      index: indexingIsPermitted,
      follow: indexingIsPermitted,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: CANONICAL_WEB_ROOT_URL,
      siteName: "What Are Your Values, Mapache?",
      title: WEB_METADATA_TITLE,
      description: WEB_METADATA_DESCRIPTION,
    },
    twitter: {
      card: "summary",
      title: WEB_METADATA_TITLE,
      description: WEB_METADATA_DESCRIPTION,
    },
  } satisfies Metadata
}
