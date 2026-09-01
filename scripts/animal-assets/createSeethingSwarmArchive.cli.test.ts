import { resolve } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getSeethingSwarmAssetCustodyPaths } from "./SeethingSwarmAssetCustody"

const dependencyMocks = vi.hoisted(() => ({
  createArchive: vi.fn(),
}))

vi.mock("./SeethingSwarmArchiveCreator", () => ({
  createSeethingSwarmArchive: dependencyMocks.createArchive,
}))

const ASSET_KEY_ENVIRONMENT_VARIABLE_NAME =
  "GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE"
const DIRECT_ENTRY_PATH = resolve(
  process.cwd(),
  "scripts/animal-assets/createSeethingSwarmArchive.cli.ts",
)
const ORIGINAL_DIRECT_ENTRY_ARGUMENT = process.argv[2]
const ORIGINAL_ASSET_KEY = process.env[ASSET_KEY_ENVIRONMENT_VARIABLE_NAME]

afterEach(() => {
  dependencyMocks.createArchive.mockReset()
  if (ORIGINAL_DIRECT_ENTRY_ARGUMENT === undefined) delete process.argv[2]
  else process.argv[2] = ORIGINAL_DIRECT_ENTRY_ARGUMENT
  if (ORIGINAL_ASSET_KEY === undefined)
    delete process.env[ASSET_KEY_ENVIRONMENT_VARIABLE_NAME]
  else process.env[ASSET_KEY_ENVIRONMENT_VARIABLE_NAME] = ORIGINAL_ASSET_KEY
})

describe("SeethingSwarm archive creator direct execution", () => {
  it("uses the current repository environment and standard output", async () => {
    const result = Object.freeze({ fileCount: 4, totalSize: 128 })
    const paths = getSeethingSwarmAssetCustodyPaths(process.cwd())
    dependencyMocks.createArchive.mockResolvedValue(result)
    process.argv[2] = DIRECT_ENTRY_PATH
    process.env[ASSET_KEY_ENVIRONMENT_VARIABLE_NAME] =
      "synthetic-direct-execution-key-with-ample-length"
    const standardOutputWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true)

    try {
      await import("./createSeethingSwarmArchive.cli")

      expect(dependencyMocks.createArchive).toHaveBeenCalledWith({
        archivePath: paths.archivePath,
        assetKey: "synthetic-direct-execution-key-with-ample-length",
        custodyDirectory: paths.custodyDirectory,
      })
      expect(standardOutputWrite).toHaveBeenCalledWith(
        "Created and verified seethingswarm-assets.zip with 4 licensed custody files.\n",
      )
    } finally {
      standardOutputWrite.mockRestore()
    }
  })
})
