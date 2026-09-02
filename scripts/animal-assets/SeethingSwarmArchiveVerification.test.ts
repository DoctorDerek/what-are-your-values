import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createSeethingSwarmArchive } from "./SeethingSwarmArchiveCreator"
import {
  SEETHING_SWARM_ARCHIVE_ENTRY_ROOT,
  SEETHING_SWARM_REQUIRED_ARCHIVE_ENTRY_NAMES,
} from "./SeethingSwarmAssetCustody"

type ExtractArchiveOptions = Readonly<{
  custodyDirectory: string
}>

const dependencyMocks = vi.hoisted(() => ({
  extractArchive: vi.fn<(options: ExtractArchiveOptions) => Promise<void>>(),
}))

vi.mock("./SeethingSwarmArchiveExtractor", () => ({
  extractSeethingSwarmArchive: dependencyMocks.extractArchive,
}))

const TEST_ASSET_KEY = "synthetic-verification-key-with-ample-length"

async function createSyntheticCustody(
  custodyDirectory: string,
  contentPrefix: string,
) {
  for (const [
    index,
    archiveEntryName,
  ] of SEETHING_SWARM_REQUIRED_ARCHIVE_ENTRY_NAMES.entries()) {
    const relativePath = archiveEntryName.slice(
      `${SEETHING_SWARM_ARCHIVE_ENTRY_ROOT}/`.length,
    )
    const filePath = resolve(custodyDirectory, relativePath)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, `${contentPrefix}-${index}`)
  }
}

describe("SeethingSwarm archive creation verification", () => {
  let repositoryRoot: string
  let custodyDirectory: string
  let archivePath: string

  beforeEach(async () => {
    repositoryRoot = await mkdtemp(
      resolve(tmpdir(), "wayvm-verification-test-"),
    )
    custodyDirectory = resolve(repositoryRoot, "vendor/seethingswarm")
    archivePath = resolve(
      repositoryRoot,
      "ghost_assets/seethingswarm-assets.zip",
    )
    await createSyntheticCustody(custodyDirectory, "source")
  })

  afterEach(async () => {
    dependencyMocks.extractArchive.mockReset()
    await rm(repositoryRoot, { force: true, recursive: true })
  })

  it("rejects verification that omits source custody files", async () => {
    dependencyMocks.extractArchive.mockImplementation(
      async ({ custodyDirectory: verificationCustodyDirectory }) => {
        await mkdir(verificationCustodyDirectory, { recursive: true })
        await writeFile(
          resolve(verificationCustodyDirectory, "registry.json"),
          "source-0",
        )
      },
    )

    await expect(
      createSeethingSwarmArchive({
        archivePath,
        assetKey: TEST_ASSET_KEY,
        custodyDirectory,
      }),
    ).rejects.toThrow("Encrypted archive verification changed its file set.")
  })

  it("rejects verification that mutates source custody bytes", async () => {
    dependencyMocks.extractArchive.mockImplementation(
      async ({ custodyDirectory: verificationCustodyDirectory }) => {
        await createSyntheticCustody(verificationCustodyDirectory, "mutated")
      },
    )

    await expect(
      createSeethingSwarmArchive({
        archivePath,
        assetKey: TEST_ASSET_KEY,
        custodyDirectory,
      }),
    ).rejects.toThrow("Encrypted archive verification changed custody data.")
  })
})
