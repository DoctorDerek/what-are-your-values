import type { SeethingSwarmStagingResult } from "./SeethingSwarmAssetStager"
import { assertSeethingSwarmStaticAssetModuleInputs } from "./SeethingSwarmStaticAssetModuleGenerator"

export function generateSeethingSwarmNativeAssetModule(
  staging: SeethingSwarmStagingResult,
) {
  assertSeethingSwarmStaticAssetModuleInputs(staging, "native")

  const sourceLines = staging.assets.flatMap(({ relativePath }) => [
    "  Object.freeze({",
    `    relativePath: ${JSON.stringify(relativePath)},`,
    `    asset: require(${JSON.stringify(`./${relativePath}`)}) as number,`,
    "  }),",
  ])

  return `${[
    'import type { SeethingSwarmStaticAssetSource } from "#game/data/src/SeethingSwarmStaticAssetAdapter"',
    "",
    "export const SEETHING_SWARM_NATIVE_STATIC_ASSET_SOURCES = Object.freeze([",
    ...sourceLines,
    "]) satisfies readonly SeethingSwarmStaticAssetSource<number>[]",
    "",
  ].join("\n")}`
}
