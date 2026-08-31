import type { SeethingSwarmStagingResult } from "./SeethingSwarmAssetStager"
import { assertSeethingSwarmStaticAssetModuleInputs } from "./SeethingSwarmStaticAssetModuleGenerator"

const webAssetIdentifierPrefix = "seethingSwarmWebAsset"

function getAssetIdentifier(index: number) {
  return `${webAssetIdentifierPrefix}${index.toString().padStart(4, "0")}`
}

export function generateSeethingSwarmWebAssetModule(
  staging: SeethingSwarmStagingResult,
) {
  assertSeethingSwarmStaticAssetModuleInputs(staging, "web")

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
