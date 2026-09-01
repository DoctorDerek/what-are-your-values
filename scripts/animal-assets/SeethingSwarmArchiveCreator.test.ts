import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { Uint8ArrayReader, ZipReader } from "@zip.js/zip.js/index-native.js"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { runSeethingSwarmArchiveCreatorCli } from "./createSeethingSwarmArchive.cli"
import { createSeethingSwarmArchive } from "./SeethingSwarmArchiveCreator"
import { extractSeethingSwarmArchive } from "./SeethingSwarmArchiveExtractor"
import {
  getSeethingSwarmAssetCustodyPaths,
  SEETHING_SWARM_ARCHIVE_ENTRY_ROOT,
  SEETHING_SWARM_ARCHIVE_LIMITS,
  SEETHING_SWARM_REQUIRED_ARCHIVE_ENTRY_NAMES,
} from "./SeethingSwarmAssetCustody"

const TEST_ASSET_KEY = "synthetic-archive-key-with-ample-length"
const LICENSED_SOURCE_SENTINEL =
  "LICENSED-SOURCE-SENTINEL-DO-NOT-EXPOSE-".repeat(16)

async function createSyntheticCustody(custodyDirectory: string) {
  for (const [
    index,
    archiveEntryName,
  ] of SEETHING_SWARM_REQUIRED_ARCHIVE_ENTRY_NAMES.entries()) {
    const custodyRelativePath = archiveEntryName.slice(
      `${SEETHING_SWARM_ARCHIVE_ENTRY_ROOT}/`.length,
    )
    const filePath = resolve(custodyDirectory, custodyRelativePath)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, `required-source-${index}`)
  }

  const sentinelPath = resolve(
    custodyDirectory,
    "assets/bat_spritesheets/idle_strip4.png",
  )
  await mkdir(dirname(sentinelPath), { recursive: true })
  await writeFile(sentinelPath, LICENSED_SOURCE_SENTINEL)
  return sentinelPath
}

async function readArchiveEntries(archivePath: string) {
  const zipReader = new ZipReader(
    new Uint8ArrayReader(await readFile(archivePath)),
    {
      filenameValidation: "strict",
      strictness: "strict",
      useWebWorkers: false,
    },
  )

  try {
    return await zipReader.getEntries({
      filenameValidation: "strict",
      strictness: "strict",
    })
  } finally {
    await zipReader.close()
  }
}

describe("SeethingSwarm archive creation", () => {
  let repositoryRoot: string

  beforeEach(async () => {
    repositoryRoot = await mkdtemp(resolve(tmpdir(), "wayvm-creator-test-"))
  })

  afterEach(async () => {
    await rm(repositoryRoot, { force: true, recursive: true })
  })

  it("creates sorted AES-256 AE-2 entries and round-trips exact custody", async () => {
    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
    await createSyntheticCustody(paths.custodyDirectory)

    const result = await createSeethingSwarmArchive({
      archivePath: paths.archivePath,
      assetKey: TEST_ASSET_KEY,
      custodyDirectory: paths.custodyDirectory,
    })

    expect(result).toEqual({
      fileCount: 5,
      totalSize:
        4 * "required-source-0".length + LICENSED_SOURCE_SENTINEL.length,
    })
    expect(Object.isFrozen(result)).toBe(true)

    const archiveData = await readFile(paths.archivePath)
    expect(archiveData.includes(Buffer.from(LICENSED_SOURCE_SENTINEL))).toBe(
      false,
    )
    expect(archiveData.includes(Buffer.from(TEST_ASSET_KEY))).toBe(false)

    const entries = await readArchiveEntries(paths.archivePath)
    const entryNames = entries.map((entry) => entry.filename)
    expect(entryNames).toEqual([...entryNames].sort())
    expect(entries).toHaveLength(5)
    for (const entry of entries) {
      expect(entry.directory).toBe(false)
      expect(entry.encrypted).toBe(true)
      expect(entry.zipCrypto).toBe(false)
      expect(entry.extraFieldAES?.strength).toBe(3)
      expect(entry.extraFieldAES?.vendorVersion).toBe(2)
      expect(entry.crc32).toBeUndefined()
    }

    const verificationVendorDirectory = resolve(
      repositoryRoot,
      "verification-vendor",
    )
    const verificationCustodyDirectory = resolve(
      verificationVendorDirectory,
      "seethingswarm",
    )
    await extractSeethingSwarmArchive({
      archivePath: paths.archivePath,
      assetKey: TEST_ASSET_KEY,
      custodyDirectory: verificationCustodyDirectory,
      vendorDirectory: verificationVendorDirectory,
    })
    await expect(
      readFile(
        resolve(
          verificationCustodyDirectory,
          "assets/bat_spritesheets/idle_strip4.png",
        ),
        "utf8",
      ),
    ).resolves.toBe(LICENSED_SOURCE_SENTINEL)
  })

  it("rotates an existing archive without temporary or backup residue", async () => {
    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
    const sentinelPath = await createSyntheticCustody(paths.custodyDirectory)
    await createSeethingSwarmArchive({
      archivePath: paths.archivePath,
      assetKey: TEST_ASSET_KEY,
      custodyDirectory: paths.custodyDirectory,
    })
    const firstArchive = await readFile(paths.archivePath)

    await writeFile(sentinelPath, `${LICENSED_SOURCE_SENTINEL}-rotated`)
    await createSeethingSwarmArchive({
      archivePath: paths.archivePath,
      assetKey: TEST_ASSET_KEY,
      custodyDirectory: paths.custodyDirectory,
    })

    expect((await readFile(paths.archivePath)).equals(firstArchive)).toBe(false)
    expect(await readdir(paths.ghostAssetsDirectory)).toEqual([
      "seethingswarm-assets.zip",
    ])
  })

  it("preserves an existing archive when source custody becomes invalid", async () => {
    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
    await createSyntheticCustody(paths.custodyDirectory)
    await createSeethingSwarmArchive({
      archivePath: paths.archivePath,
      assetKey: TEST_ASSET_KEY,
      custodyDirectory: paths.custodyDirectory,
    })
    const validArchive = await readFile(paths.archivePath)
    await unlink(resolve(paths.custodyDirectory, "assets/staging-receipt.json"))

    await expect(
      createSeethingSwarmArchive({
        archivePath: paths.archivePath,
        assetKey: TEST_ASSET_KEY,
        custodyDirectory: paths.custodyDirectory,
      }),
    ).rejects.toThrow("Licensed custody is missing required files.")
    expect((await readFile(paths.archivePath)).equals(validArchive)).toBe(true)
  })

  it("rejects empty licensed custody", async () => {
    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
    await mkdir(paths.custodyDirectory, { recursive: true })

    await expect(
      createSeethingSwarmArchive({
        archivePath: paths.archivePath,
        assetKey: TEST_ASSET_KEY,
        custodyDirectory: paths.custodyDirectory,
      }),
    ).rejects.toThrow("Licensed custody contains an invalid file count.")
  })

  it("rejects symbolic links inside licensed custody", async () => {
    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
    await createSyntheticCustody(paths.custodyDirectory)
    const externalDirectory = resolve(repositoryRoot, "external-assets")
    await mkdir(externalDirectory)
    await symlink(
      externalDirectory,
      resolve(paths.custodyDirectory, "linked-assets"),
      "junction",
    )

    await expect(
      createSeethingSwarmArchive({
        archivePath: paths.archivePath,
        assetKey: TEST_ASSET_KEY,
        custodyDirectory: paths.custodyDirectory,
      }),
    ).rejects.toThrow("Licensed custody cannot contain symbolic links.")
  })

  it.runIf(process.platform === "linux")(
    "rejects case-ambiguous licensed custody names",
    async () => {
      const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
      await createSyntheticCustody(paths.custodyDirectory)
      await writeFile(
        resolve(paths.custodyDirectory, "assets/ambiguous.png"),
        "lowercase",
      )
      await writeFile(
        resolve(paths.custodyDirectory, "assets/AMBIGUOUS.png"),
        "uppercase",
      )

      await expect(
        createSeethingSwarmArchive({
          archivePath: paths.archivePath,
          assetKey: TEST_ASSET_KEY,
          custodyDirectory: paths.custodyDirectory,
        }),
      ).rejects.toThrow("Licensed custody contains ambiguous file names.")
    },
  )

  it("rejects licensed custody files above the per-entry limit", async () => {
    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
    await createSyntheticCustody(paths.custodyDirectory)
    await writeFile(
      resolve(paths.custodyDirectory, "assets/oversized.png"),
      Buffer.alloc(SEETHING_SWARM_ARCHIVE_LIMITS.maximumEntrySizeBytes + 1),
    )

    await expect(
      createSeethingSwarmArchive({
        archivePath: paths.archivePath,
        assetKey: TEST_ASSET_KEY,
        custodyDirectory: paths.custodyDirectory,
      }),
    ).rejects.toThrow("Licensed custody file exceeds its size limit.")
  })

  it("rejects licensed custody above the aggregate size limit", async () => {
    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
    await createSyntheticCustody(paths.custodyDirectory)
    const maximumEntry = Buffer.alloc(
      SEETHING_SWARM_ARCHIVE_LIMITS.maximumEntrySizeBytes,
    )

    for (let index = 0; index < 4; index += 1) {
      await writeFile(
        resolve(paths.custodyDirectory, `assets/boundary-${index}.png`),
        maximumEntry,
      )
    }

    await expect(
      createSeethingSwarmArchive({
        archivePath: paths.archivePath,
        assetKey: TEST_ASSET_KEY,
        custodyDirectory: paths.custodyDirectory,
      }),
    ).rejects.toThrow("Licensed custody payload exceeds its size limit.")
  })

  it("rejects weak keys and archive output inside licensed custody", async () => {
    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
    await createSyntheticCustody(paths.custodyDirectory)

    await expect(
      createSeethingSwarmArchive({
        archivePath: paths.archivePath,
        assetKey: "too-short",
        custodyDirectory: paths.custodyDirectory,
      }),
    ).rejects.toThrow("must contain at least 32 characters")
    await expect(
      createSeethingSwarmArchive({
        archivePath: resolve(paths.custodyDirectory, "exposed.zip"),
        assetKey: TEST_ASSET_KEY,
        custodyDirectory: paths.custodyDirectory,
      }),
    ).rejects.toThrow("must remain outside licensed custody")
  })

  it("requires the canonical key and reports only safe archive metadata", async () => {
    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
    await createSyntheticCustody(paths.custodyDirectory)

    await expect(
      runSeethingSwarmArchiveCreatorCli({
        environment: {},
        repositoryRoot,
      }),
    ).rejects.toThrow(
      "GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE is required",
    )

    const statusMessages: string[] = []
    await runSeethingSwarmArchiveCreatorCli({
      environment: {
        GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE: TEST_ASSET_KEY,
      },
      repositoryRoot,
      writeStatus: (message) => statusMessages.push(message),
    })

    expect(statusMessages).toEqual([
      "Created and verified seethingswarm-assets.zip with 5 licensed custody files.\n",
    ])
    expect(statusMessages.join("")).not.toContain(TEST_ASSET_KEY)
    expect(statusMessages.join("")).not.toContain(repositoryRoot)
  })
})
