import { createRobotsMetadata } from "@/lib/WebDiscovery"

export const dynamic = "force-static"

export default function robots() {
  return createRobotsMetadata(process.env.VERCEL_ENV)
}
