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
import {
  createWayvmExportV1TestVector,
  WAYVM_EXPORT_V1_TEST_VECTOR,
} from "./WayvmExportV1TestVector"

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

  it("freezes representative schema-one bytes and every portable semantic field", async () => {
    const { wayvmExport, serialized, customValueId, firstBattleAchievementId } =
      await createWayvmExportV1TestVector()
    const decoded = await decodeWayvmExport(serialized)

    expect(new TextEncoder().encode(serialized)).toHaveLength(
      WAYVM_EXPORT_V1_TEST_VECTOR.expectedByteLength,
    )
    expect(wayvmExport.contentHash).toBe(
      WAYVM_EXPORT_V1_TEST_VECTOR.expectedContentHash,
    )
    expect(decoded).toEqual(wayvmExport)
    expect(serializeWayvmExport(decoded)).toBe(serialized)
    expect(decoded.playerData.profile.activeDeck.customValues).toEqual([
      expect.objectContaining({
        id: customValueId,
        name: "Ingenuity 🦝",
        definition:
          "Finding creative, resourceful paths through meaningful problems—con curiosidad.",
      }),
    ])
    expect(decoded.playerData.profile.scheduler.scheduleKind).toBe("join-pass")
    expect(decoded.playerData.profile.history).toHaveLength(1)
    expect(decoded.playerData.profile.redo).toHaveLength(1)
    expect(
      decoded.playerData.profile.progressById.get(customValueId)?.totalXp,
    ).toBeGreaterThan(0)
    expect(decoded.playerData.achievements.unlocks).toEqual([
      expect.objectContaining({ id: firstBattleAchievementId }),
    ])
    expect(decoded.playerData.achievements.presentedAchievementIds).toEqual([
      firstBattleAchievementId,
    ])
    expect(decoded.playerData.achievements.progress.lifetimeBattleCount).toBe(2)
    expect(decoded.playerData.settings).toEqual({
      locale: "en",
      reducedMotion: "on",
      controlHints: "always",
    })
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

  it("rejects noncanonical JSON bytes even when their parsed meaning and checksum are unchanged", async () => {
    const serialized = serializeWayvmExport(await createExportFixture())
    const noncanonicalSerialized = serialized.replace("[", "[ ")

    await expect(decodeWayvmExport(noncanonicalSerialized)).rejects.toThrow(
      "WAYVM Export encoding is not canonical",
    )
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
        (await createWayvmExportV1TestVector()).serialized,
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
