import type {
  SeethingSwarmLicensedRuntimeClipCatalog,
  SeethingSwarmRuntimeAuxiliaryEffectClip,
  SeethingSwarmRuntimeCharacterClip,
  SeethingSwarmVisibleContentBounds,
} from "#game/data/src/SeethingSwarmRuntimeClipCatalog"

type SeethingSwarmRuntimeClip<PlatformAsset> =
  | SeethingSwarmRuntimeCharacterClip<PlatformAsset>
  | SeethingSwarmRuntimeAuxiliaryEffectClip<PlatformAsset>

export function getSeethingSwarmRuntimeAssetImportPath(relativePath: string) {
  return `./assets/${relativePath}`
}

export function listSeethingSwarmRuntimeClips<PlatformAsset>(
  catalog: SeethingSwarmLicensedRuntimeClipCatalog<PlatformAsset>,
) {
  return catalog.animals.flatMap(({ characterClips, auxiliaryEffectClips }) => [
    ...characterClips,
    ...auxiliaryEffectClips,
  ])
}

function serializeVisibleBounds(
  bounds: SeethingSwarmVisibleContentBounds,
  indentation: string,
) {
  return [
    `${indentation}visibleBounds: Object.freeze({`,
    `${indentation}  left: ${bounds.left},`,
    `${indentation}  top: ${bounds.top},`,
    `${indentation}  width: ${bounds.width},`,
    `${indentation}  height: ${bounds.height},`,
    `${indentation}}),`,
  ]
}

function serializeRuntimeClip<PlatformAsset>(
  clip: SeethingSwarmRuntimeClip<PlatformAsset>,
  assetExpression: string,
  indentation: string,
) {
  return [
    `${indentation}Object.freeze({`,
    `${indentation}  kind: ${JSON.stringify(clip.kind)},`,
    `${indentation}  animalId: ${JSON.stringify(clip.animalId)},`,
    `${indentation}  ${clip.kind === "character" ? "animationId" : "effectId"}: ${JSON.stringify(clip.kind === "character" ? clip.animationId : clip.effectId)},`,
    `${indentation}  relativePath: ${JSON.stringify(clip.relativePath)},`,
    `${indentation}  frameWidth: ${clip.frameWidth},`,
    `${indentation}  frameHeight: ${clip.frameHeight},`,
    `${indentation}  frameCount: ${clip.frameCount},`,
    ...serializeVisibleBounds(clip.visibleBounds, `${indentation}  `),
    `${indentation}  asset: ${assetExpression},`,
    `${indentation}}),`,
  ]
}

export function serializeSeethingSwarmLicensedRuntimeClipCatalog<PlatformAsset>(
  catalog: SeethingSwarmLicensedRuntimeClipCatalog<PlatformAsset>,
  getAssetExpression: (
    clip: SeethingSwarmRuntimeClip<PlatformAsset>,
    assetIndex: number,
  ) => string,
) {
  let assetIndex = 0
  const animalLines = catalog.animals.flatMap((animal) => {
    const characterLines = animal.characterClips.flatMap((clip) => {
      const lines = serializeRuntimeClip(
        clip,
        getAssetExpression(clip, assetIndex),
        "      ",
      )
      assetIndex += 1
      return lines
    })
    const auxiliaryEffectLines = animal.auxiliaryEffectClips.flatMap((clip) => {
      const lines = serializeRuntimeClip(
        clip,
        getAssetExpression(clip, assetIndex),
        "      ",
      )
      assetIndex += 1
      return lines
    })

    return [
      "    Object.freeze({",
      `      animalId: ${JSON.stringify(animal.animalId)},`,
      "      characterClips: Object.freeze([",
      ...characterLines,
      "      ]),",
      "      auxiliaryEffectClips: Object.freeze([",
      ...auxiliaryEffectLines,
      "      ]),",
      "    }),",
    ]
  })

  return [
    "Object.freeze({",
    '  mode: "licensed",',
    `  evidenceSnapshotId: ${JSON.stringify(catalog.evidenceSnapshotId)},`,
    "  animals: Object.freeze([",
    ...animalLines,
    "  ]),",
    `  characterClipCount: ${catalog.characterClipCount},`,
    `  auxiliaryEffectClipCount: ${catalog.auxiliaryEffectClipCount},`,
    "})",
  ]
}

export function generateSeethingSwarmTypographyOnlyRuntimeClipCatalogModule(
  exportName: string,
) {
  return `${[
    'import { createSeethingSwarmTypographyOnlyRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"',
    "",
    `export const ${exportName} =`,
    "  createSeethingSwarmTypographyOnlyRuntimeClipCatalog()",
    "",
  ].join("\n")}`
}
