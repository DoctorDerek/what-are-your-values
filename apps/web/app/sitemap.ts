import { createSitemapMetadata } from "@/lib/WebDiscovery"

export const dynamic = "force-static"

export default function sitemap() {
  return createSitemapMetadata()
}
