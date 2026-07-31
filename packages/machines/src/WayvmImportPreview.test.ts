import { describe, expect, it } from "vitest"
import { applyAchievementTransition } from "./AchievementTransition"
import { applyBattleChoice } from "./BattleProfile"
import { createBattleChoiceEvent } from "./BattleProfileEvent"
import { projectBattlePair } from "./BattleScheduler"
import { createCustomValueAddCommit } from "./CustomValueCommands"
import {
  createInitialPlayerData,
  createPlayerData,
  type PlayerData,
} from "./PlayerData"
import { createWayvmExport, serializeWayvmExport } from "./WayvmExport"
import {
  createWayvmImportPreview,
  prepareWayvmImport,
} from "./WayvmImportPreview"

async function createPlayedExport() {
  const initial = createInitialPlayerData({
    schedulerSeed: "import-preview-seed",
    createdAt: "2026-07-29T00:00:00.000Z",
  })
  const pair = projectBattlePair(
    initial.profile.activeDeck,
    initial.profile.scheduler,
  )
  const transition = applyBattleChoice({
    profile: initial.profile,
    winnerId: pair[0],
    expectedScheduler: initial.profile.scheduler,
  })
  const event = createBattleChoiceEvent(transition)
  const playerData = createPlayerData({
    ...initial,
    profile: transition.profile,
    achievements: applyAchievementTransition({
      state: initial.achievements,
      priorProfile: initial.profile,
      resultingProfile: transition.profile,
      event,
      occurredAt: "2026-07-29T00:01:00.000Z",
    }),
  })

  return createWayvmExport({
    exportedAt: "2026-07-29T00:02:00.000Z",
    sourceAppVersion: "0.1.0",
    sourceBuild: "preview-build",
    playerData,
  })
}

function addCustomValue({
  playerData,
  name,
  randomUuid,
  occurredAt,
}: {
  readonly playerData: PlayerData
  readonly name: string
  readonly randomUuid: string
  readonly occurredAt: string
}) {
  const commit = createCustomValueAddCommit({
    profile: playerData.profile,
    name,
    definition: `${name} is personally important.`,
    now: () => occurredAt,
    randomUuid: () => randomUuid,
  })

  return createPlayerData({
    ...playerData,
    profile: commit.profile,
    achievements: applyAchievementTransition({
      state: playerData.achievements,
      priorProfile: playerData.profile,
      resultingProfile: commit.profile,
      event: commit.event,
      occurredAt,
    }),
  })
}

describe("WAYVM Import Preview", () => {
  it("projects understandable replacement facts from validated player data", async () => {
    const wayvmExport = await createPlayedExport()

    expect(createWayvmImportPreview(wayvmExport)).toEqual({
      exportedAt: "2026-07-29T00:02:00.000Z",
      sourceAppVersion: "0.1.0",
      sourceBuild: "preview-build",
      saveSchemaVersion: 1,
      canonicalCatalogVersion: "pvcs-2011-100-v1",
      totalComparisons: 1,
      currentCycle: 1,
      customValueCount: 0,
      customValueNames: [],
      activeValueCount: 100,
      activePairCycleSize: 4_950,
      deckRevision: 0,
      progressGeneration: 0,
      unlockedAchievementCount: 1,
      achievementProgressGeneration: 0,
      locale: "en",
      replacesCurrentLocalData: true,
    })
  })

  it("lists every Custom Value name in deterministic creation order", async () => {
    const initialPlayerData = createInitialPlayerData({
      schedulerSeed: "import-preview-custom-value-seed",
      createdAt: "2026-07-29T00:00:00.000Z",
    })
    const withIngenuity = addCustomValue({
      playerData: initialPlayerData,
      name: "Ingenuity",
      randomUuid: "00000000-0000-4000-8000-000000000001",
      occurredAt: "2026-07-29T00:01:00.000Z",
    })
    const withDestiny = addCustomValue({
      playerData: withIngenuity,
      name: "Destiny",
      randomUuid: "00000000-0000-4000-8000-000000000002",
      occurredAt: "2026-07-29T00:02:00.000Z",
    })
    const wayvmExport = await createWayvmExport({
      exportedAt: "2026-07-29T00:03:00.000Z",
      sourceAppVersion: "0.1.0",
      sourceBuild: "custom-value-preview-build",
      playerData: withDestiny,
    })
    const preview = createWayvmImportPreview(wayvmExport)

    expect(preview.customValueCount).toBe(2)
    expect(preview.customValueNames).toEqual(["Ingenuity", "Destiny"])
    expect(Object.isFrozen(preview.customValueNames)).toBe(true)
  })

  it("prepares a candidate without changing or dropping its validated bytes", async () => {
    const wayvmExport = await createPlayedExport()
    const prepared = await prepareWayvmImport(serializeWayvmExport(wayvmExport))

    expect(prepared.wayvmExport).toEqual(wayvmExport)
    expect(prepared.preview.totalComparisons).toBe(1)
    expect(prepared.preview.replacesCurrentLocalData).toBe(true)
  })

  it("rejects inconsistent aggregate comparison evidence", async () => {
    const wayvmExport = await createPlayedExport()
    const firstValueId = wayvmExport.playerData.profile.activeDeck.valueIds[0]
    if (!firstValueId) {
      throw new Error("Import preview fixture has no active values")
    }
    const progressById = new Map(wayvmExport.playerData.profile.progressById)
    const firstProgress = progressById.get(firstValueId)
    if (!firstProgress) {
      throw new Error("Import preview fixture has no first-value progress")
    }
    progressById.set(firstValueId, {
      ...firstProgress,
      profileComparisons: firstProgress.profileComparisons + 1,
    })

    expect(() =>
      createWayvmImportPreview({
        ...wayvmExport,
        playerData: {
          ...wayvmExport.playerData,
          profile: {
            ...wayvmExport.playerData.profile,
            progressById,
          },
        },
      }),
    ).toThrow("Export comparison evidence is inconsistent")
  })

  it("rejects a cycle whose one-based display number is unsafe", async () => {
    const wayvmExport = await createPlayedExport()

    expect(() =>
      createWayvmImportPreview({
        ...wayvmExport,
        playerData: {
          ...wayvmExport.playerData,
          profile: {
            ...wayvmExport.playerData.profile,
            scheduler: {
              ...wayvmExport.playerData.profile.scheduler,
              cycleIndex: Number.MAX_SAFE_INTEGER,
            },
          },
        },
      }),
    ).toThrow("Export cycle number cannot be represented safely")
  })
})
