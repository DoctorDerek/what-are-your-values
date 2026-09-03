import type { SeethingSwarmRuntimeClipCatalog } from "#game/data/src/SeethingSwarmRuntimeClipCatalog"
import {
  generateSeethingSwarmTypographyOnlyRuntimeClipCatalogModule,
  getSeethingSwarmRuntimeAssetImportPath,
  serializeSeethingSwarmLicensedRuntimeClipCatalog,
} from "./SeethingSwarmRuntimeClipCatalogModuleGenerator"

const NATIVE_RUNTIME_CLIP_CATALOG_EXPORT_NAME =
  "SEETHING_SWARM_NATIVE_RUNTIME_CLIP_CATALOG"

export function generateSeethingSwarmNativeRuntimeClipCatalogModule(
  catalog: SeethingSwarmRuntimeClipCatalog<string>,
) {
  if (catalog.mode === "typography-only") {
    return generateSeethingSwarmTypographyOnlyRuntimeClipCatalogModule(
      NATIVE_RUNTIME_CLIP_CATALOG_EXPORT_NAME,
    )
  }

  const catalogLines = serializeSeethingSwarmLicensedRuntimeClipCatalog(
    catalog,
    ({ relativePath }) =>
      `require(${JSON.stringify(getSeethingSwarmRuntimeAssetImportPath(relativePath))}) as number`,
  )
  const licensedCatalogLines = [
    ...catalogLines.slice(0, -1),
    `${catalogLines.at(-1)!} satisfies SeethingSwarmLicensedRuntimeClipCatalog<number>`,
  ]

  return `${[
    'import type { SeethingSwarmLicensedRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"',
    "",
    `export const ${NATIVE_RUNTIME_CLIP_CATALOG_EXPORT_NAME} = ${licensedCatalogLines[0]}`,
    ...licensedCatalogLines.slice(1),
    "",
  ].join("\n")}`
}
