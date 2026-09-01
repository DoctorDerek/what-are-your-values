import { resolve } from "node:path"

export const SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME =
  "GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE"
export const SEETHING_SWARM_ARCHIVE_FILE_NAME = "seethingswarm-assets.zip"
export const SEETHING_SWARM_ARCHIVE_ENTRY_ROOT = "seethingswarm"
export const SEETHING_SWARM_REQUIRED_ARCHIVE_ENTRY_NAMES = Object.freeze([
  "seethingswarm/registry.json",
  "seethingswarm/assets/staging-receipt.json",
  "seethingswarm/assets/SeethingSwarmNativeStaticAssets.ts",
  "seethingswarm/assets/SeethingSwarmWebStaticAssets.ts",
] as const)

export type SeethingSwarmAssetEnvironment = Readonly<{
  [SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME]?: string
}>

export function getSeethingSwarmAssetCustodyPaths(repositoryRoot: string) {
  const resolvedRepositoryRoot = resolve(repositoryRoot)
  const ghostAssetsDirectory = resolve(resolvedRepositoryRoot, "ghost_assets")
  const vendorDirectory = resolve(resolvedRepositoryRoot, "vendor")

  return Object.freeze({
    archivePath: resolve(
      ghostAssetsDirectory,
      SEETHING_SWARM_ARCHIVE_FILE_NAME,
    ),
    custodyDirectory: resolve(
      vendorDirectory,
      SEETHING_SWARM_ARCHIVE_ENTRY_ROOT,
    ),
    ghostAssetsDirectory,
    vendorDirectory,
  })
}

export function getSeethingSwarmAssetKey(
  environment: SeethingSwarmAssetEnvironment = process.env,
) {
  return environment[SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME]
}
