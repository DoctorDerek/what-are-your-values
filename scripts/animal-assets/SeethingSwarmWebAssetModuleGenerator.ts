import type { SeethingSwarmStagingResult } from "./SeethingSwarmAssetStager"

const webAssetIdentifierPrefix = "seethingSwarmWebAsset"

function compareText(first: string, second: string) {
  if (first < second) return -1
  if (first > second) return 1
  return 0
}

function assertRelativePngPath(relativePath: string) {
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
      `Invalid SeethingSwarm web asset path: ${relativePath || "empty"}`,
    )
  }
}

function assertWebAssetInputs(staging: SeethingSwarmStagingResult) {
  if (staging.evidenceSnapshotId.trim() === "") {
    throw new Error("Missing SeethingSwarm web evidence snapshot ID")
  }
  if (staging.assets.length === 0) {
    throw new Error("Missing SeethingSwarm web assets")
  }

  const comparablePaths = new Set<string>()
  for (const [index, asset] of staging.assets.entries()) {
    assertRelativePngPath(asset.relativePath)
    if (!Number.isSafeInteger(asset.byteLength) || asset.byteLength <= 0) {
      throw new Error(
        `Invalid SeethingSwarm web asset byte length: ${asset.relativePath}`,
      )
    }

    const comparablePath = asset.relativePath.toLowerCase()
    if (comparablePaths.has(comparablePath)) {
      throw new Error(
        `Duplicate SeethingSwarm web asset path: ${asset.relativePath}`,
      )
    }
    comparablePaths.add(comparablePath)

    const priorPath = staging.assets[index - 1]?.relativePath
    if (priorPath && compareText(priorPath, asset.relativePath) >= 0) {
      throw new Error(
        `Unsorted SeethingSwarm web asset path: ${asset.relativePath}`,
      )
    }
  }

  const derivedTotalBytes = staging.assets.reduce(
    (totalBytes, asset) => totalBytes + asset.byteLength,
    0,
  )
  if (derivedTotalBytes !== staging.totalBytes) {
    throw new Error(
      `Invalid SeethingSwarm web asset byte total: expected ${derivedTotalBytes}, received ${staging.totalBytes}`,
    )
  }
}

function getAssetIdentifier(index: number) {
  return `${webAssetIdentifierPrefix}${index.toString().padStart(4, "0")}`
}

export function generateSeethingSwarmWebAssetModule(
  staging: SeethingSwarmStagingResult,
) {
  assertWebAssetInputs(staging)

  const importLines = staging.assets.map(
    ({ relativePath }, index) =>
      `import ${getAssetIdentifier(index)} from ${JSON.stringify(`./${relativePath}`)}`,
  )
  const sourceLines = staging.assets.flatMap(({ relativePath }, index) => [
    "  Object.freeze({",
    `    relativePath: ${JSON.stringify(relativePath)},`,
    `    asset: ${getAssetIdentifier(index)},`,
    "  }),",
  ])

  return `${[
    'import type { SeethingSwarmStaticAssetSource } from "#game/data/src/SeethingSwarmStaticAssetAdapter"',
    ...importLines,
    "",
    "export const SEETHING_SWARM_WEB_STATIC_ASSET_SOURCES = Object.freeze([",
    ...sourceLines,
    "]) satisfies readonly SeethingSwarmStaticAssetSource<unknown>[]",
    "",
  ].join("\n")}`
}
