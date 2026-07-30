import {
  createCustomValueId,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import { describe, expect, it } from "vitest"
import { applyAchievementTransition } from "./AchievementTransition"
import {
  createBattleChoiceCommit,
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
    expect(candidate.profile.scheduler.deckRevision).toBe(
      playerData.profile.scheduler.deckRevision + 1,
    )
    expect(candidate.profile.scheduler.progressGeneration).toBe(
      playerData.profile.scheduler.progressGeneration,
    )
    expect(candidate.profile.history).toEqual([])
    expect(candidate.profile.redo).toEqual([])
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
    expect(candidate.settings).toEqual(playerData.settings)
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

    expect(candidate.profile.activeDeck).toBe(playerData.profile.activeDeck)
    expect(candidate.profile.activeDeck.customValues).toEqual([INGENUITY])
    expect(candidate.profile.scheduler.deckRevision).toBe(
      playerData.profile.scheduler.deckRevision,
    )
    expect(candidate.profile.scheduler.progressGeneration).toBe(
      playerData.profile.scheduler.progressGeneration + 1,
    )
    expect(candidate.profile.scheduler.seed).toBe("fresh-progress-generation")
    expect(candidate.profile.history).toEqual([])
    expect(
      Array.from(candidate.profile.progressById.values()).every(
        ({ totalXp, profileWins, profileComparisons, currentCycleWins }) =>
          totalXp === 0 &&
          profileWins === 0 &&
          profileComparisons === 0 &&
          currentCycleWins === 0,
      ),
    ).toBe(true)
    expect(candidate.achievements.unlocks).toEqual(
      playerData.achievements.unlocks,
    )
    expect(candidate.achievements.progress.lifetimeBattleCount).toBe(
      playerData.achievements.progress.lifetimeBattleCount,
    )
    expect(candidate.achievements.progress.countedBattleWindow).toEqual([])
    expect(
      new Set(candidate.achievements.progress.baselineLevelsByValue.values()),
    ).toEqual(new Set([1]))
    expect(candidate.settings).toEqual(playerData.settings)
    expect(candidate.progressGenerationStartedAt).toBe(RESET_AT)
  })

  it("restarts only achievements with retained replay guards and current-level baselines", () => {
    const playerData = createPlayedCustomPlayerData()
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
      completedCycleCount: 0,
      countedBattleWindow: playerData.profile.history.map(
        ({ battleId }) => battleId,
      ),
    })
    playerData.profile.activeDeck.valueIds.forEach((valueId) => {
      expect(
        candidate.achievements.progress.baselineLevelsByValue.get(valueId),
      ).toBeGreaterThanOrEqual(1)
    })
  })
})
