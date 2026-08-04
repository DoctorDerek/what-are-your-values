import {
  createCustomValueId,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import { getLevelFromXP } from "@game/utils/src/LevelMath"
import { describe, expect, it } from "vitest"
import { createAchievementState } from "./AchievementState"
import { applyAchievementTransition } from "./AchievementTransition"
import {
  createBattleChoiceCommit,
  createBattleUndoCommit,
  createDeckRevisionCommit,
  type BattleProfileCommit,
} from "./BattleProfileCommit"
import { projectBattlePair } from "./BattleScheduler"
import {
  createInitialPlayerData,
  createPlayerData,
  type PlayerData,
} from "./PlayerData"
import {
  createAchievementsResetCandidate,
  createDeleteAllCustomValuesCandidate,
  createLevelsAndExperienceResetCandidate,
  createScopedPlayerDataResetCandidate,
} from "./PlayerDataReset"

const CREATED_AT = "2026-07-29T00:00:00.000Z"
const RESET_AT = "2026-07-29T12:00:00.000Z"

const INGENUITY = Object.freeze({
  kind: "custom",
  id: createCustomValueId("custom:00000000-0000-4000-8000-000000000099"),
  name: "Ingenuity",
  definition: "The practice of making original solutions.",
  creationOrdinal: 1,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
}) satisfies CustomValueDefinition

function applyCommit(playerData: PlayerData, commit: BattleProfileCommit) {
  return createPlayerData({
    ...playerData,
    profile: commit.profile,
    achievements: applyAchievementTransition({
      state: playerData.achievements,
      priorProfile: playerData.profile,
      resultingProfile: commit.profile,
      event: commit.event,
      occurredAt: RESET_AT,
    }),
  })
}

function createPlayedCustomPlayerData() {
  const initial = createInitialPlayerData({
    schedulerSeed: "player-data-reset-seed",
    createdAt: CREATED_AT,
  })
  const withCustomValue = applyCommit(
    initial,
    createDeckRevisionCommit({
      profile: initial.profile,
      revisedCustomValues: [INGENUITY],
    }),
  )
  const pair = projectBattlePair(
    withCustomValue.profile.activeDeck,
    withCustomValue.profile.scheduler,
  )
  const winnerId = pair.find((valueId) => valueId !== INGENUITY.id) ?? pair[0]

  return applyCommit(
    withCustomValue,
    createBattleChoiceCommit({
      profile: withCustomValue.profile,
      winnerId,
      expectedScheduler: withCustomValue.profile.scheduler,
    }),
  )
}

function playCanonicalBattles(battleCount: number) {
  let playerData = createInitialPlayerData({
    schedulerSeed: "canonical-reset-seed",
    createdAt: CREATED_AT,
  })

  for (let battleIndex = 0; battleIndex < battleCount; battleIndex += 1) {
    const winnerId = projectBattlePair(
      playerData.profile.activeDeck,
      playerData.profile.scheduler,
    )[0]
    playerData = applyCommit(
      playerData,
      createBattleChoiceCommit({
        profile: playerData.profile,
        winnerId,
        expectedScheduler: playerData.profile.scheduler,
      }),
    )
  }

  return playerData
}

describe("Player Data Reset", () => {
  it("deletes every Custom Value through one deck revision while preserving canonical progress achievements and settings", () => {
    const playerData = createPlayedCustomPlayerData()
    const canonicalWinnerId = playerData.profile.history[0]?.winnerId
    if (!canonicalWinnerId) {
      throw new Error("Played reset fixture has no retained winner")
    }

    const candidate = createDeleteAllCustomValuesCandidate({
      playerData,
      deletedAt: RESET_AT,
    })

    expect(candidate.profile.activeDeck.customValues).toEqual([])
    expect(candidate.profile.activeDeck.valueIds).toHaveLength(100)
    expect(candidate.profile.scheduler.deckRevision).toBe(
      playerData.profile.scheduler.deckRevision + 1,
    )
    expect(candidate.profile.scheduler.progressGeneration).toBe(
      playerData.profile.scheduler.progressGeneration,
    )
    expect(candidate.profile.history).toEqual([])
    expect(candidate.profile.redo).toEqual([])
    expect(candidate.profile.progressById.has(INGENUITY.id)).toBe(false)
    expect(candidate.profile.progressById.get(canonicalWinnerId)).toMatchObject(
      {
        totalXp:
          playerData.profile.progressById.get(canonicalWinnerId)?.totalXp,
        profileWins:
          playerData.profile.progressById.get(canonicalWinnerId)?.profileWins,
        profileComparisons:
          playerData.profile.progressById.get(canonicalWinnerId)
            ?.profileComparisons,
        currentCycleWins: 0,
      },
    )
    expect(candidate.achievements.unlocks).toEqual(
      playerData.achievements.unlocks,
    )
    expect(candidate.achievements.progress.lifetimeBattleCount).toBe(
      playerData.achievements.progress.lifetimeBattleCount,
    )
    expect(candidate.achievements.progress.countedBattleWindow.ids).toEqual([])
    expect(candidate.settings).toEqual(playerData.settings)
    expect(candidate.progressGenerationStartedAt).toBe(
      playerData.progressGenerationStartedAt,
    )
  })

  it("rejects Delete All Custom Values when no authored values exist", () => {
    const playerData = createInitialPlayerData({
      schedulerSeed: "no-custom-values",
      createdAt: CREATED_AT,
    })

    expect(() =>
      createDeleteAllCustomValuesCandidate({
        playerData,
        deletedAt: RESET_AT,
      }),
    ).toThrow("There are no Custom Values to delete")
  })

  it("restarts levels and scheduling while retaining the active deck achievement history and settings", () => {
    const playerData = createPlayedCustomPlayerData()
    const candidate = createLevelsAndExperienceResetCandidate({
      playerData,
      resetAt: RESET_AT,
      schedulerSeed: "fresh-progress-generation",
    })

    expect(candidate.profile.activeDeck).toEqual(playerData.profile.activeDeck)
    expect(candidate.profile.activeDeck.customValues).toEqual([INGENUITY])
    expect(candidate.profile.scheduler.deckRevision).toBe(
      playerData.profile.scheduler.deckRevision,
    )
    expect(candidate.profile.scheduler.progressGeneration).toBe(
      playerData.profile.scheduler.progressGeneration + 1,
    )
    expect(candidate.profile.scheduler.seed).toBe("fresh-progress-generation")
    expect(candidate.profile.history).toEqual([])
    expect(candidate.profile.redo).toEqual([])
    expect(
      Array.from(candidate.profile.progressById.values()).every(
        ({ totalXp, profileWins, profileComparisons, currentCycleWins }) =>
          totalXp === 0 &&
          profileWins === 0 &&
          profileComparisons === 0 &&
          currentCycleWins === 0,
      ),
    ).toBe(true)
    expect(new Set(candidate.profile.cyclePayoutTierSnapshot.values())).toEqual(
      new Set([1]),
    )
    expect(candidate.achievements.unlocks).toEqual(
      playerData.achievements.unlocks,
    )
    expect(candidate.achievements.presentedAchievementIds).toEqual(
      playerData.achievements.presentedAchievementIds,
    )
    expect(candidate.achievements.progress).toMatchObject({
      achievementProgressGeneration:
        playerData.achievements.progress.achievementProgressGeneration,
      lifetimeBattleCount: playerData.achievements.progress.lifetimeBattleCount,
      topFiveAlreadyRevealedAtReset: false,
      countedBattleWindow: { ids: [] },
    })
    expect(
      new Set(candidate.achievements.progress.baselineLevelsByValue.values()),
    ).toEqual(new Set([1]))
    expect(candidate.settings).toEqual(playerData.settings)
    expect(candidate.progressGenerationStartedAt).toBe(RESET_AT)
  })

  it("restarts only achievements with retained replay guards and current-level baselines", () => {
    const playedPlayerData = createPlayedCustomPlayerData()
    const undoCommit = createBattleUndoCommit(playedPlayerData.profile)
    if (!undoCommit) {
      throw new Error("Achievement reset fixture cannot create Redo history")
    }
    const playerData = applyCommit(playedPlayerData, undoCommit)
    const candidate = createAchievementsResetCandidate({ playerData })

    expect(candidate.profile).toEqual(playerData.profile)
    expect(candidate.settings).toEqual(playerData.settings)
    expect(candidate.progressGenerationStartedAt).toBe(
      playerData.progressGenerationStartedAt,
    )
    expect(candidate.achievements.unlocks).toEqual([])
    expect(candidate.achievements.presentedAchievementIds).toEqual([])
    expect(candidate.achievements.progress).toMatchObject({
      achievementProgressGeneration:
        playerData.achievements.progress.achievementProgressGeneration + 1,
      lifetimeBattleCount: 0,
      countedBattleWindow: {
        ids: [...playerData.profile.history, ...playerData.profile.redo].map(
          ({ battleId }) => battleId,
        ),
      },
    })
    playerData.profile.activeDeck.valueIds.forEach((valueId) => {
      const progress = playerData.profile.progressById.get(valueId)
      if (!progress) {
        throw new Error("Achievement reset baseline fixture is incomplete")
      }

      expect(
        candidate.achievements.progress.baselineLevelsByValue.get(valueId),
      ).toBe(getLevelFromXP(progress.totalXp))
    })
  })

  it("records an already-earned Top Five and lets a later progress reset restore eligibility", () => {
    const playerData = playCanonicalBattles(5)
    const achievementsReset = createAchievementsResetCandidate({ playerData })
    const progressReset = createLevelsAndExperienceResetCandidate({
      playerData: achievementsReset,
      resetAt: RESET_AT,
      schedulerSeed: "top-five-reset-seed",
    })

    expect(
      achievementsReset.achievements.progress.topFiveAlreadyRevealedAtReset,
    ).toBe(true)
    expect(
      progressReset.achievements.progress.topFiveAlreadyRevealedAtReset,
    ).toBe(false)
  })

  it("rejects an unsafe achievement generation without mutating the source aggregate", () => {
    const playerData = createInitialPlayerData({
      schedulerSeed: "unsafe-achievement-generation",
      createdAt: CREATED_AT,
    })
    const saturatedPlayerData = createPlayerData({
      ...playerData,
      achievements: createAchievementState({
        ...playerData.achievements,
        activeDeck: playerData.profile.activeDeck,
        progress: {
          ...playerData.achievements.progress,
          achievementProgressGeneration: Number.MAX_SAFE_INTEGER,
        },
      }),
    })

    expect(() =>
      createAchievementsResetCandidate({ playerData: saturatedPlayerData }),
    ).toThrow("Achievement progress generation cannot be incremented safely")
    expect(saturatedPlayerData.achievements.progress).toMatchObject({
      achievementProgressGeneration: Number.MAX_SAFE_INTEGER,
      lifetimeBattleCount: 0,
    })
  })

  it("rejects achievement reset when an active value has no level baseline", () => {
    const playerData = createInitialPlayerData({
      schedulerSeed: "missing-achievement-baseline",
      createdAt: CREATED_AT,
    })
    const missingValueId = playerData.profile.activeDeck.valueIds[0]
    if (!missingValueId) {
      throw new Error("Achievement baseline fixture has no active values")
    }
    const incompleteProgressById = new Map(playerData.profile.progressById)
    incompleteProgressById.delete(missingValueId)
    const incompletePlayerData = Object.freeze({
      ...playerData,
      profile: Object.freeze({
        ...playerData.profile,
        progressById: incompleteProgressById,
      }),
    }) satisfies PlayerData

    expect(() =>
      createAchievementsResetCandidate({ playerData: incompletePlayerData }),
    ).toThrow(
      `Value progress is unavailable during achievement reset: ${missingValueId}`,
    )
  })

  it.each([
    ["delete-all-custom-values", 0, 1, 0],
    ["reset-levels-and-experience", 1, 0, 0],
    ["reset-achievements", 0, 0, 1],
  ] as const)(
    "dispatches %s through only its owned generation",
    (
      resetKind,
      progressGenerationDelta,
      deckRevisionDelta,
      achievementDelta,
    ) => {
      const playerData = createPlayedCustomPlayerData()
      const candidate = createScopedPlayerDataResetCandidate({
        playerData,
        resetAt: RESET_AT,
        resetKind,
      })

      expect(candidate.profile.scheduler.progressGeneration).toBe(
        playerData.profile.scheduler.progressGeneration +
          progressGenerationDelta,
      )
      expect(candidate.profile.scheduler.deckRevision).toBe(
        playerData.profile.scheduler.deckRevision + deckRevisionDelta,
      )
      expect(
        candidate.achievements.progress.achievementProgressGeneration,
      ).toBe(
        playerData.achievements.progress.achievementProgressGeneration +
          achievementDelta,
      )
    },
  )
})
