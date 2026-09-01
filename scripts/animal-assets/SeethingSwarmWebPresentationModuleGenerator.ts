import type { SeethingSwarmAnimalPresentationAdapter } from "#game/data/src/SeethingSwarmAnimalPresentation"
import {
  assertSeethingSwarmPreparedPresentationAdapter,
  getSeethingSwarmPresentationAssetImportPath,
  serializeSeethingSwarmPresentationModuleEntry,
} from "./SeethingSwarmPresentationAssetPreparer"

const webAssetIdentifierPrefix = "seethingSwarmWebAnimal"

function getWebAssetIdentifier(index: number) {
  return `${webAssetIdentifierPrefix}${index.toString().padStart(2, "0")}`
}

function generateTypographyOnlyModule() {
  return `${[
    'import { createSeethingSwarmTypographyOnlyAnimalPresentationAdapter } from "@game/data/src/SeethingSwarmAnimalPresentation"',
    "",
    "export const SEETHING_SWARM_WEB_ANIMAL_PRESENTATIONS =",
    "  createSeethingSwarmTypographyOnlyAnimalPresentationAdapter()",
    "",
  ].join("\n")}`
}

export function generateSeethingSwarmWebPresentationModule(
  adapter: SeethingSwarmAnimalPresentationAdapter<string>,
) {
  assertSeethingSwarmPreparedPresentationAdapter(adapter, "web")
  if (adapter.mode === "typography-only") return generateTypographyOnlyModule()

  const importLines = adapter.animals.map(
    ({ asset }, index) =>
      `import ${getWebAssetIdentifier(index)} from ${JSON.stringify(
        getSeethingSwarmPresentationAssetImportPath(asset),
      )}`,
  )
  const presentationLines = adapter.animals.flatMap((presentation, index) =>
    serializeSeethingSwarmPresentationModuleEntry(
      presentation,
      getWebAssetIdentifier(index),
    ),
  )

  return `${[
    'import type { SeethingSwarmLicensedAnimalPresentationAdapter } from "@game/data/src/SeethingSwarmAnimalPresentation"',
    ...importLines,
    "",
    "export const SEETHING_SWARM_WEB_ANIMAL_PRESENTATIONS = Object.freeze({",
    '  mode: "licensed",',
    `  evidenceSnapshotId: ${JSON.stringify(adapter.evidenceSnapshotId)},`,
    "  animals: Object.freeze([",
    ...presentationLines,
    "  ]),",
    "}) satisfies SeethingSwarmLicensedAnimalPresentationAdapter<unknown>",
    "",
  ].join("\n")}`
}
