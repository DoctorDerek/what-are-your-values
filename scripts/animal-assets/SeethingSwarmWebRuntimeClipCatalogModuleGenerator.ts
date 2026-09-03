import type { SeethingSwarmRuntimeClipCatalog } from "#game/data/src/SeethingSwarmRuntimeClipCatalog"
import {
  generateSeethingSwarmTypographyOnlyRuntimeClipCatalogModule,
  getSeethingSwarmRuntimeAssetImportPath,
  listSeethingSwarmRuntimeClips,
  serializeSeethingSwarmLicensedRuntimeClipCatalog,
} from "./SeethingSwarmRuntimeClipCatalogModuleGenerator"

const WEB_RUNTIME_CLIP_CATALOG_EXPORT_NAME =
  "SEETHING_SWARM_WEB_RUNTIME_CLIP_CATALOG"
const webAssetIdentifierPrefix = "seethingSwarmWebClip"

function getWebAssetIdentifier(index: number) {
  return `${webAssetIdentifierPrefix}${index.toString().padStart(4, "0")}`
}

export function generateSeethingSwarmWebRuntimeClipCatalogModule(
  catalog: SeethingSwarmRuntimeClipCatalog<string>,
) {
  if (catalog.mode === "typography-only") {
    return generateSeethingSwarmTypographyOnlyRuntimeClipCatalogModule(
      WEB_RUNTIME_CLIP_CATALOG_EXPORT_NAME,
    )
  }

  const importLines = listSeethingSwarmRuntimeClips(catalog).map(
    ({ relativePath }, index) =>
      `import ${getWebAssetIdentifier(index)} from ${JSON.stringify(getSeethingSwarmRuntimeAssetImportPath(relativePath))}`,
  )
  const catalogLines = serializeSeethingSwarmLicensedRuntimeClipCatalog(
    catalog,
    (_, assetIndex) => getWebAssetIdentifier(assetIndex),
  )
  const licensedCatalogLines = [
    ...catalogLines.slice(0, -1),
    `${catalogLines.at(-1)!} satisfies SeethingSwarmLicensedRuntimeClipCatalog<StaticImageData>`,
  ]

  return `${[
    'import type { SeethingSwarmLicensedRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"',
    'import type { StaticImageData } from "next/image"',
    ...importLines,
    "",
    `export const ${WEB_RUNTIME_CLIP_CATALOG_EXPORT_NAME} = ${licensedCatalogLines[0]}`,
    ...licensedCatalogLines.slice(1),
    "",
  ].join("\n")}`
}
