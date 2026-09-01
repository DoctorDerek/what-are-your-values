import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  getSeethingSwarmAssetCustodyPaths,
  getSeethingSwarmAssetKey,
  SEETHING_SWARM_ARCHIVE_ENTRY_ROOT,
  SEETHING_SWARM_ARCHIVE_FILE_NAME,
  SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME,
} from "./SeethingSwarmAssetCustody"

describe("SeethingSwarm asset custody", () => {
  it("owns one immutable repository-local archive and extraction contract", () => {
    const repositoryRoot = resolve("temporary-wayvm-repository")
    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)

    expect(SEETHING_SWARM_ARCHIVE_FILE_NAME).toBe("seethingswarm-assets.zip")
    expect(SEETHING_SWARM_ARCHIVE_ENTRY_ROOT).toBe("seethingswarm")
    expect(paths).toEqual({
      archivePath: resolve(
        repositoryRoot,
        "ghost_assets",
        "seethingswarm-assets.zip",
      ),
      custodyDirectory: resolve(repositoryRoot, "vendor", "seethingswarm"),
      ghostAssetsDirectory: resolve(repositoryRoot, "ghost_assets"),
      vendorDirectory: resolve(repositoryRoot, "vendor"),
    })
    expect(Object.isFrozen(paths)).toBe(true)
  })

  it("reads the asset key only from its canonical environment variable", () => {
    expect(SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME).toBe(
      "GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE",
    )
    expect(
      getSeethingSwarmAssetKey({
        GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE: "synthetic-secret",
      }),
    ).toBe("synthetic-secret")
    expect(getSeethingSwarmAssetKey({})).toBeUndefined()
  })
})
