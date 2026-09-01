import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipWriter,
} from "@zip.js/zip.js/index-native.js"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { extractSeethingSwarmArchive } from "./SeethingSwarmArchiveExtractor"
import {
  getSeethingSwarmAssetCustodyPaths,
  SEETHING_SWARM_REQUIRED_ARCHIVE_ENTRY_NAMES,
} from "./SeethingSwarmAssetCustody"
import { runSeethingSwarmAssetDecryption } from "./SeethingSwarmAssetDecryption"

const TEST_ASSET_KEY = "synthetic-test-key"

type TestArchiveEntry = {
  content?: string
  directory?: boolean
  encrypted?: boolean
  name: string
  unixMode?: number
  zipCrypto?: boolean
}

function getRequiredTestArchiveEntries(): readonly TestArchiveEntry[] {
  return SEETHING_SWARM_REQUIRED_ARCHIVE_ENTRY_NAMES.map((name, index) => ({
    content: `required-custody-${index}`,
    name,
  }))
}

async function writeTestArchive(
  archivePath: string,
  entries: readonly TestArchiveEntry[],
) {
  const zipWriter = new ZipWriter(new Uint8ArrayWriter(), {
    useWebWorkers: false,
  })

  for (const entry of entries) {
    const options = {
      directory: entry.directory,
      encryptionStrength: 3 as const,
      extendedTimestamp: false,
      lastModDate: new Date("2026-01-01T00:00:00.000Z"),
      password: entry.encrypted === false ? undefined : TEST_ASSET_KEY,
      unixMode: entry.unixMode,
      useWebWorkers: false,
      zipCrypto: entry.zipCrypto,
    }

    if (entry.directory) {
      await zipWriter.add(entry.name, undefined, options)
    } else {
      await zipWriter.add(
        entry.name,
        new Uint8ArrayReader(
          new TextEncoder().encode(entry.content ?? entry.name),
        ),
        options,
      )
    }
  }

  await mkdir(dirname(archivePath), { recursive: true })
  await writeFile(archivePath, await zipWriter.close())
}

async function expectNoTemporaryCustodyDirectories(vendorDirectory: string) {
  const directoryEntries = await readdir(vendorDirectory)
  expect(
    directoryEntries.filter((entryName) =>
      entryName.startsWith(".seethingswarm-"),
    ),
  ).toEqual([])
}

describe("SeethingSwarm archive extraction", () => {
  let repositoryRoot: string

  beforeEach(async () => {
    repositoryRoot = await mkdtemp(resolve(tmpdir(), "wayvm-custody-test-"))
  })

  afterEach(async () => {
    await rm(repositoryRoot, { force: true, recursive: true })
  })

  it("authenticates AES entries and atomically replaces existing custody", async () => {
    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
    await mkdir(paths.custodyDirectory, { recursive: true })
    await writeFile(
      resolve(paths.custodyDirectory, "obsolete-source.txt"),
      "obsolete",
    )
    await writeTestArchive(paths.archivePath, [
      ...getRequiredTestArchiveEntries(),
      {
        content: "synthetic-png",
        name: "seethingswarm/assets/bat_spritesheets/idle_strip4.png",
      },
    ])

    await extractSeethingSwarmArchive({
      archivePath: paths.archivePath,
      assetKey: TEST_ASSET_KEY,
      custodyDirectory: paths.custodyDirectory,
      vendorDirectory: paths.vendorDirectory,
    })

    await expect(
      readFile(resolve(paths.custodyDirectory, "registry.json"), "utf8"),
    ).resolves.toBe("required-custody-0")
    await expect(
      readFile(
        resolve(
          paths.custodyDirectory,
          "assets/bat_spritesheets/idle_strip4.png",
        ),
        "utf8",
      ),
    ).resolves.toBe("synthetic-png")
    await expect(
      readFile(resolve(paths.custodyDirectory, "obsolete-source.txt")),
    ).rejects.toThrow()
    await expectNoTemporaryCustodyDirectories(paths.vendorDirectory)
  })

  it("preserves existing custody when archive authentication fails", async () => {
    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
    const existingMarkerPath = resolve(
      paths.custodyDirectory,
      "existing-marker.txt",
    )
    await mkdir(paths.custodyDirectory, { recursive: true })
    await writeFile(existingMarkerPath, "preserved")
    await writeTestArchive(paths.archivePath, getRequiredTestArchiveEntries())

    await expect(
      extractSeethingSwarmArchive({
        archivePath: paths.archivePath,
        assetKey: "incorrect-key",
        custodyDirectory: paths.custodyDirectory,
        vendorDirectory: paths.vendorDirectory,
      }),
    ).rejects.toThrow()
    await expect(readFile(existingMarkerPath, "utf8")).resolves.toBe(
      "preserved",
    )
    await expectNoTemporaryCustodyDirectories(paths.vendorDirectory)
  })

  it("rejects archives missing any required custody entry", async () => {
    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
    await writeTestArchive(
      paths.archivePath,
      getRequiredTestArchiveEntries().slice(0, -1),
    )

    await expect(
      extractSeethingSwarmArchive({
        archivePath: paths.archivePath,
        assetKey: TEST_ASSET_KEY,
        custodyDirectory: paths.custodyDirectory,
        vendorDirectory: paths.vendorDirectory,
      }),
    ).rejects.toThrow("Archive is missing required custody entries.")
    await expectNoTemporaryCustodyDirectories(paths.vendorDirectory)
  })

  it("rejects plaintext and legacy ZipCrypto entries", async () => {
    for (const invalidEntry of [
      { encrypted: false },
      { zipCrypto: true },
    ] as const) {
      const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
      const entries = getRequiredTestArchiveEntries().map((entry, index) =>
        index === 0 ? { ...entry, ...invalidEntry } : entry,
      )
      await writeTestArchive(paths.archivePath, entries)

      await expect(
        extractSeethingSwarmArchive({
          archivePath: paths.archivePath,
          assetKey: TEST_ASSET_KEY,
          custodyDirectory: paths.custodyDirectory,
          vendorDirectory: paths.vendorDirectory,
        }),
      ).rejects.toThrow("Archive contains an invalid custody entry type.")
    }
  })

  it.each([
    "../outside.txt",
    "/seethingswarm/absolute.txt",
    "other-root/outside.txt",
    "seethingswarm/../outside.txt",
    "seethingswarm/assets\\outside.txt",
    "seethingswarm/assets//outside.txt",
    "seethingswarm/assets/./outside.txt",
  ])("rejects unsafe archive path %s", async (invalidEntryName) => {
    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
    await writeTestArchive(paths.archivePath, [
      ...getRequiredTestArchiveEntries(),
      { name: invalidEntryName },
    ])

    await expect(
      extractSeethingSwarmArchive({
        archivePath: paths.archivePath,
        assetKey: TEST_ASSET_KEY,
        custodyDirectory: paths.custodyDirectory,
        vendorDirectory: paths.vendorDirectory,
      }),
    ).rejects.toThrow()
    await expectNoTemporaryCustodyDirectories(paths.vendorDirectory)
  })

  it("rejects directory symbolic-link and case-ambiguous entries", async () => {
    const invalidEntryGroups: readonly (readonly TestArchiveEntry[])[] = [
      [{ directory: true, name: "seethingswarm/assets/folder/" }],
      [
        {
          content: "../outside.txt",
          name: "seethingswarm/assets/link",
          unixMode: 0o120777,
        },
      ],
      [
        { name: "seethingswarm/assets/duplicate.png" },
        { name: "seethingswarm/assets/DUPLICATE.png" },
      ],
    ]

    for (const invalidEntries of invalidEntryGroups) {
      const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
      await writeTestArchive(paths.archivePath, [
        ...getRequiredTestArchiveEntries(),
        ...invalidEntries,
      ])

      await expect(
        extractSeethingSwarmArchive({
          archivePath: paths.archivePath,
          assetKey: TEST_ASSET_KEY,
          custodyDirectory: paths.custodyDirectory,
          vendorDirectory: paths.vendorDirectory,
        }),
      ).rejects.toThrow()
    }
  })

  it("keeps unkeyed builds successful and keyed failures secret-safe", async () => {
    const statusMessages: string[] = []
    const unkeyedResult = await runSeethingSwarmAssetDecryption({
      environment: {},
      repositoryRoot,
      writeStatus: (message) => statusMessages.push(message),
    })

    expect(unkeyedResult).toEqual({ mode: "unkeyed" })
    expect(Object.isFrozen(unkeyedResult)).toBe(true)
    expect(statusMessages.join("")).toContain(
      "continuing without protected archive extraction",
    )

    await expect(
      runSeethingSwarmAssetDecryption({
        environment: {
          GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE: TEST_ASSET_KEY,
        },
        repositoryRoot,
      }),
    ).rejects.toThrow("seethingswarm-assets.zip is missing")

    const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
    await writeTestArchive(paths.archivePath, getRequiredTestArchiveEntries())
    let invalidKeyError: unknown
    try {
      await runSeethingSwarmAssetDecryption({
        environment: {
          GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE: "private-wrong-key",
        },
        repositoryRoot,
      })
    } catch (error: unknown) {
      invalidKeyError = error
    }

    expect(invalidKeyError).toBeInstanceOf(Error)
    expect((invalidKeyError as Error).message).toBe(
      "SeethingSwarm asset extraction failed; verify the encrypted archive and its protected key.",
    )
    expect((invalidKeyError as Error).message).not.toContain(
      "private-wrong-key",
    )
    expect((invalidKeyError as Error).message).not.toContain(repositoryRoot)
  })
})
