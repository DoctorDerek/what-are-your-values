import { resolve } from "node:path"

export function sanitizeSeethingSwarmPrivateSourceError(
  error: unknown,
  sourceRoot: string,
  operationLabel: string,
) {
  const message = error instanceof Error ? error.message : "Unknown failure"
  const absoluteSourceRoot = resolve(sourceRoot)
  const pathVariants = new Set([
    sourceRoot,
    absoluteSourceRoot,
    sourceRoot.replaceAll("\\", "/"),
    absoluteSourceRoot.replaceAll("\\", "/"),
  ])

  let sanitizedMessage = message
  for (const pathVariant of pathVariants) {
    if (pathVariant !== "") {
      sanitizedMessage = sanitizedMessage.replaceAll(
        pathVariant,
        "[private source root]",
      )
    }
  }

  return new Error(
    `SeethingSwarm ${operationLabel} failed: ${sanitizedMessage}`,
  )
}
