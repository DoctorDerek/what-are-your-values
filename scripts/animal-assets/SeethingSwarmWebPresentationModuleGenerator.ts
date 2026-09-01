import type {
  SeethingSwarmAnimalPresentation,
  SeethingSwarmAnimalPresentationAdapter,
} from "#game/data/src/SeethingSwarmAnimalPresentation"
import {
  assertSeethingSwarmPreparedPresentationAdapter,
  getSeethingSwarmPresentationAssetImportPath,
} from "./SeethingSwarmPresentationAssetPreparer"

const webAssetIdentifierPrefix = "seethingSwarmWebAnimal"

function getWebAssetIdentifier(index: number) {
  return `${webAssetIdentifierPrefix}${index.toString().padStart(2, "0")}`
}

function serializeVisibleBounds(
  presentation: SeethingSwarmAnimalPresentation<string>,
) {
  return [
    "      visibleBounds: Object.freeze({",
    `        left: ${presentation.visibleBounds.left},`,
    `        top: ${presentation.visibleBounds.top},`,
    `        width: ${presentation.visibleBounds.width},`,
    `        height: ${presentation.visibleBounds.height},`,
    "      }),",
  ]
}

function serializePresentation(
  presentation: SeethingSwarmAnimalPresentation<string>,
  index: number,
) {
  return [
    "    Object.freeze({",
    `      animalId: ${JSON.stringify(presentation.animalId)},`,
    `      animationId: ${JSON.stringify(presentation.animationId)},`,
    `      relativePath: ${JSON.stringify(presentation.relativePath)},`,
    `      frameWidth: ${presentation.frameWidth},`,
    `      frameHeight: ${presentation.frameHeight},`,
    `      frameCount: ${presentation.frameCount},`,
    ...serializeVisibleBounds(presentation),
    `      integerScale: ${presentation.integerScale},`,
    `      frameOffsetX: ${presentation.frameOffsetX},`,
    `      frameOffsetY: ${presentation.frameOffsetY},`,
    `      asset: ${getWebAssetIdentifier(index)},`,
    "    }),",
  ]
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
  const presentationLines = adapter.animals.flatMap(serializePresentation)

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
