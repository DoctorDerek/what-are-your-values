import type { SeethingSwarmAnimalPresentationAdapter } from "#game/data/src/SeethingSwarmAnimalPresentation"
import {
  assertSeethingSwarmPreparedPresentationAdapter,
  getSeethingSwarmPresentationAssetImportPath,
  serializeSeethingSwarmPresentationModuleEntry,
} from "./SeethingSwarmPresentationAssetPreparer"

function generateTypographyOnlyModule() {
  return `${[
    'import { createSeethingSwarmTypographyOnlyAnimalPresentationAdapter } from "@game/data/src/SeethingSwarmAnimalPresentation"',
    "",
    "export const SEETHING_SWARM_NATIVE_ANIMAL_PRESENTATIONS =",
    "  createSeethingSwarmTypographyOnlyAnimalPresentationAdapter()",
    "",
  ].join("\n")}`
}

export function generateSeethingSwarmNativePresentationModule(
  adapter: SeethingSwarmAnimalPresentationAdapter<string>,
) {
  assertSeethingSwarmPreparedPresentationAdapter(adapter, "native")
  if (adapter.mode === "typography-only") return generateTypographyOnlyModule()

  const presentationLines = adapter.animals.flatMap((presentation) =>
    serializeSeethingSwarmPresentationModuleEntry(
      presentation,
      `require(${JSON.stringify(
        getSeethingSwarmPresentationAssetImportPath(presentation.asset),
      )}) as number`,
    ),
  )

  return `${[
    'import type { SeethingSwarmLicensedAnimalPresentationAdapter } from "@game/data/src/SeethingSwarmAnimalPresentation"',
    "",
    "export const SEETHING_SWARM_NATIVE_ANIMAL_PRESENTATIONS = Object.freeze({",
    '  mode: "licensed",',
    `  evidenceSnapshotId: ${JSON.stringify(adapter.evidenceSnapshotId)},`,
    "  animals: Object.freeze([",
    ...presentationLines,
    "  ]),",
    "}) satisfies SeethingSwarmLicensedAnimalPresentationAdapter<number>",
    "",
  ].join("\n")}`
}
