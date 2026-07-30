import { describe, expect, it } from "vitest"
import { parsePersistedJson, serializePersistedJson } from "./PersistedJson"
import { createInitialPlayerData } from "./PlayerData"
import { createSha256Hex } from "./Sha256"
import {
  createWayvmExport,
  createWayvmExportFilename,
  decodeWayvmExport,
  MAX_EXPORT_METADATA_STRING_LENGTH,
  serializeWayvmExport,
} from "./WayvmExport"

const EXPORTED_AT = "2026-07-29T12:34:56.000Z"

async function createExportFixture() {
  return createWayvmExport({
    exportedAt: EXPORTED_AT,
    sourceAppVersion: "0.1.0",
    sourceBuild: "development",
    playerData: createInitialPlayerData({
      schedulerSeed: "wayvm-export-seed",
      createdAt: "2026-07-29T00:00:00.000Z",
    }),
  })
}

describe("WAYVM Export", () => {
  it("round-trips a complete canonical checksummed player backup", async () => {
    const wayvmExport = await createExportFixture()
    const serialized = serializeWayvmExport(wayvmExport)

    await expect(decodeWayvmExport(serialized)).resolves.toEqual(wayvmExport)
    expect(wayvmExport.contentHash).toMatch(/^[0-9a-f]{64}$/)
    expect(wayvmExport.activeDeckFingerprint).toBe(
      wayvmExport.playerData.profile.activeDeck.fingerprint,
    )
  })

  it("rejects altered bytes and malformed integrity fields", async () => {
    const serialized = serializeWayvmExport(await createExportFixture())
    const altered = serialized.replace('"development"', '"altered-development"')
    const tuple = parsePersistedJson(serialized)
    if (!Array.isArray(tuple)) {
      throw new Error("The export fixture is not a tuple")
    }
    const invalidHash = [...tuple]
    invalidHash[11] = "invalid"

    await expect(decodeWayvmExport(altered)).rejects.toThrow(
      "Export content hash does not match",
    )
    await expect(
      decodeWayvmExport(serializePersistedJson(invalidHash)),
    ).rejects.toThrow("Invalid Export content hash")
  })

  it.each([
    {
      index: 0,
      value: "future-export",
      issue: "Unsupported export format",
    },
    {
      index: 1,
      value: 2,
      issue: "Unsupported export format version",
    },
    {
      index: 5,
      value: 2,
      issue: "Unsupported save schema version",
    },
    {
      index: 6,
      value: "future-catalog",
      issue: "Unsupported canonical catalog version",
    },
  ])(
    "rejects unsupported outer metadata at index $index",
    async ({ index, value, issue }) => {
      const tuple = parsePersistedJson(
        serializeWayvmExport(await createExportFixture()),
      )
      if (!Array.isArray(tuple)) {
        throw new Error("The export fixture is not a tuple")
      }
      tuple[index] = value

      await expect(
        decodeWayvmExport(serializePersistedJson(tuple)),
      ).rejects.toThrow(issue)
    },
  )

  it("rejects empty or unbounded source metadata before hashing", async () => {
    const playerData = createInitialPlayerData({
      schedulerSeed: "invalid-export-metadata-seed",
      createdAt: "2026-07-29T00:00:00.000Z",
    })

    await expect(
      createWayvmExport({
        exportedAt: EXPORTED_AT,
        sourceAppVersion: "",
        sourceBuild: "development",
        playerData,
      }),
    ).rejects.toThrow("Invalid source application version")
    await expect(
      createWayvmExport({
        exportedAt: EXPORTED_AT,
        sourceAppVersion: "0.1.0",
        sourceBuild: "x".repeat(MAX_EXPORT_METADATA_STRING_LENGTH + 1),
        playerData,
      }),
    ).rejects.toThrow("Invalid source build")
  })

  it("rejects outer identity that disagrees with the inner player data", async () => {
    const wayvmExport = await createExportFixture()
    const tuple = parsePersistedJson(serializeWayvmExport(wayvmExport))
    if (!Array.isArray(tuple)) {
      throw new Error("The export fixture is not a tuple")
    }
    tuple[8] = wayvmExport.deckRevision + 1
    tuple[11] = await createSha256Hex(
      serializePersistedJson(tuple.slice(0, 11)),
    )

    await expect(
      decodeWayvmExport(serializePersistedJson(tuple)),
    ).rejects.toThrow("Export identity does not match its player data")
  })

  it("creates the canonical UTC backup filename", () => {
    expect(createWayvmExportFilename(EXPORTED_AT)).toBe(
      "what-are-your-values-mapache-backup-2026-07-29-123456Z.json",
    )
  })
})
