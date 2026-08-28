export const CANONICAL_WEB_ORIGIN =
  "https://www.whatareyourvaluesmapache.com" as const

export const SHIPPED_ENGLISH_WEB_PATH = "/" as const

export const CANONICAL_WEB_ROOT_URL =
  `${CANONICAL_WEB_ORIGIN}${SHIPPED_ENGLISH_WEB_PATH}` as const

export function isCanonicalProductionDeployment(
  vercelEnvironment: string | undefined,
) {
  return vercelEnvironment === "production"
}
