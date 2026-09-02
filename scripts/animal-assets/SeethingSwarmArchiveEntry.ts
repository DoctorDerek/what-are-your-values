import { relative, resolve, sep } from "node:path"
import { SEETHING_SWARM_ARCHIVE_ENTRY_ROOT } from "./SeethingSwarmAssetCustody"

const SAFE_ARCHIVE_ENTRY_NAME_PATTERN = /^[A-Za-z0-9._/-]+$/

export function validateSeethingSwarmArchiveEntryName(entryName: string) {
  const expectedPrefix = `${SEETHING_SWARM_ARCHIVE_ENTRY_ROOT}/`
  const entryPathSegments = entryName.split("/")

  if (
    !entryName.startsWith(expectedPrefix) ||
    entryName.includes("\\") ||
    !SAFE_ARCHIVE_ENTRY_NAME_PATTERN.test(entryName) ||
    entryPathSegments.some(
      (entryPathSegment) =>
        entryPathSegment === "" ||
        entryPathSegment === "." ||
        entryPathSegment === "..",
    )
  )
    throw new Error("Archive contains an unsafe custody entry name.")

  return entryPathSegments
}

export function resolveSeethingSwarmArchiveOutputPath(
  extractionDirectory: string,
  entryName: string,
) {
  const entryPathSegments = validateSeethingSwarmArchiveEntryName(entryName)
  const resolvedExtractionDirectory = resolve(extractionDirectory)
  const outputPath = resolve(resolvedExtractionDirectory, ...entryPathSegments)
  const relativeOutputPath = relative(resolvedExtractionDirectory, outputPath)

  if (relativeOutputPath === ".." || relativeOutputPath.startsWith(`..${sep}`))
    throw new Error("Archive entry resolves outside its custody boundary.")

  return outputPath
}
