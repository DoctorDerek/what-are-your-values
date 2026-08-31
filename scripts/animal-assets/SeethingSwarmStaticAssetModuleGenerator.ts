import type { SeethingSwarmStagingResult } from "./SeethingSwarmAssetStager"

function compareText(first: string, second: string) {
  if (first < second) return -1
  if (first > second) return 1
  return 0
}

function assertRelativePngPath(relativePath: string, platformLabel: string) {
  const segments = relativePath.split("/")
  if (
    relativePath === "" ||
    relativePath.includes("\\") ||
    relativePath.startsWith("/") ||
    !relativePath.endsWith(".png") ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    throw new Error(
      `Invalid SeethingSwarm ${platformLabel} asset path: ${relativePath || "empty"}`,
    )
  }
}

export function assertSeethingSwarmStaticAssetModuleInputs(
  staging: SeethingSwarmStagingResult,
  platformLabel: string,
) {
  if (staging.evidenceSnapshotId.trim() === "") {
    throw new Error(
      `Missing SeethingSwarm ${platformLabel} evidence snapshot ID`,
    )
  }
  if (staging.assets.length === 0) {
    throw new Error(`Missing SeethingSwarm ${platformLabel} assets`)
  }

  const comparablePaths = new Set<string>()
  for (const [index, asset] of staging.assets.entries()) {
    assertRelativePngPath(asset.relativePath, platformLabel)
    if (!Number.isSafeInteger(asset.byteLength) || asset.byteLength <= 0) {
      throw new Error(
        `Invalid SeethingSwarm ${platformLabel} asset byte length: ${asset.relativePath}`,
      )
    }

    const comparablePath = asset.relativePath.toLowerCase()
    if (comparablePaths.has(comparablePath)) {
      throw new Error(
        `Duplicate SeethingSwarm ${platformLabel} asset path: ${asset.relativePath}`,
      )
    }
    comparablePaths.add(comparablePath)

    const priorPath = staging.assets[index - 1]?.relativePath
    if (priorPath && compareText(priorPath, asset.relativePath) >= 0) {
      throw new Error(
        `Unsorted SeethingSwarm ${platformLabel} asset path: ${asset.relativePath}`,
      )
    }
  }

  const derivedTotalBytes = staging.assets.reduce(
    (totalBytes, asset) => totalBytes + asset.byteLength,
    0,
  )
  if (derivedTotalBytes !== staging.totalBytes) {
    throw new Error(
      `Invalid SeethingSwarm ${platformLabel} asset byte total: expected ${derivedTotalBytes}, received ${staging.totalBytes}`,
    )
  }
}
