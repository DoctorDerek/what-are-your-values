import type { ValueId } from "@game/data/src/Value"
import { getLevelFromXP } from "@game/utils/src/LevelMath"
import {
  createAchievementState,
  type AchievementState,
} from "./AchievementState"
import { applyAchievementTransition } from "./AchievementTransition"
import type { BattleProfile } from "./BattleProfile"
import { createDeckRevisionCommit } from "./BattleProfileCommit"
import { createPlayerData, type PlayerData } from "./PlayerData"
import { createProgressResetCandidate } from "./ProgressReset"

export type PlayerDataResetKind =
  | "delete-all-custom-values"
  | "reset-levels-and-experience"
  | "reset-achievements"
  | "delete-all-data"

export type ScopedPlayerDataResetKind = Exclude<
  PlayerDataResetKind,
  "delete-all-data"
>

function getReachableBattleIds(profile: BattleProfile) {
  return Object.freeze(
    [...profile.history, ...profile.redo].map(({ battleId }) => battleId),
  )
}

function incrementAchievementProgressGeneration(state: AchievementState) {
  const generation = state.progress.achievementProgressGeneration
  if (generation === Number.MAX_SAFE_INTEGER) {
    throw new Error(
      "Achievement progress generation cannot be incremented safely",
    )
  }

  return generation + 1
}

function getCurrentValueLevel(profile: BattleProfile, valueId: ValueId) {
  const progress = profile.progressById.get(valueId)
  if (!progress) {
    throw new Error(
      `Value progress is unavailable during achievement reset: ${valueId}`,
    )
  }

  return getLevelFromXP(progress.totalXp)
}

export function createDeleteAllCustomValuesCandidate({
  playerData,
  deletedAt,
}: {
  readonly playerData: PlayerData
  readonly deletedAt: string
}) {
  if (playerData.profile.activeDeck.customValues.length === 0) {
    throw new Error("There are no Custom Values to delete")
  }

  const commit = createDeckRevisionCommit({
    profile: playerData.profile,
    revisedCustomValues: [],
  })

  return createPlayerData({
    ...playerData,
    profile: commit.profile,
    achievements: applyAchievementTransition({
      state: playerData.achievements,
      priorProfile: playerData.profile,
      resultingProfile: commit.profile,
      event: commit.event,
      occurredAt: deletedAt,
    }),
  })
}

export function createLevelsAndExperienceResetCandidate({
  playerData,
  resetAt,
  schedulerSeed,
}: {
  readonly playerData: PlayerData
  readonly resetAt: string
  readonly schedulerSeed: string
}) {
  const profile = playerData.profile
  const candidate = createProgressResetCandidate({
    activeDeck: profile.activeDeck,
    progressById: profile.progressById,
    deckRevision: profile.scheduler.deckRevision,
    progressGeneration: profile.scheduler.progressGeneration,
    seed: schedulerSeed,
  })
  const resetProfile = Object.freeze({
    activeDeck: candidate.activeDeck,
    progressById: candidate.progressById,
    cycleLevelSnapshot: candidate.cycleLevelSnapshot,
    scheduler: candidate.scheduler,
    history: [],
    redo: [],
  }) satisfies BattleProfile

  return createPlayerData({
    profile: resetProfile,
    achievements: createAchievementState({
      activeDeck: resetProfile.activeDeck,
      unlocks: playerData.achievements.unlocks,
      presentedAchievementIds: playerData.achievements.presentedAchievementIds,
      progress: {
        ...playerData.achievements.progress,
        baselineLevelsByValue: new Map(
          resetProfile.activeDeck.valueIds.map((valueId) => [valueId, 1]),
        ),
        topFiveAlreadyRevealedAtReset: false,
        countedBattleWindow: [],
      },
    }),
    settings: playerData.settings,
    progressGenerationStartedAt: resetAt,
  })
}

export function createAchievementsResetCandidate({
  playerData,
}: {
  readonly playerData: PlayerData
}) {
  const profile = playerData.profile

  return createPlayerData({
    ...playerData,
    achievements: createAchievementState({
      activeDeck: profile.activeDeck,
      unlocks: [],
      presentedAchievementIds: [],
      progress: {
        achievementProgressGeneration: incrementAchievementProgressGeneration(
          playerData.achievements,
        ),
        lifetimeBattleCount: 0,
        completedCycleCount: 0,
        baselineLevelsByValue: new Map(
          profile.activeDeck.valueIds.map((valueId) => [
            valueId,
            getCurrentValueLevel(profile, valueId),
          ]),
        ),
        topFiveAlreadyRevealedAtReset:
          Array.from(profile.progressById.values()).filter(
            ({ totalXp }) => totalXp > 0,
          ).length >= 5,
        countedBattleWindow: getReachableBattleIds(profile),
      },
    }),
  })
}

export function createScopedPlayerDataResetCandidate({
  playerData,
  resetAt,
  resetKind,
}: {
  readonly playerData: PlayerData
  readonly resetAt: string
  readonly resetKind: ScopedPlayerDataResetKind
}) {
  if (resetKind === "delete-all-custom-values") {
    return createDeleteAllCustomValuesCandidate({
      playerData,
      deletedAt: resetAt,
    })
  }

  if (resetKind === "reset-levels-and-experience") {
    return createLevelsAndExperienceResetCandidate({
      playerData,
      resetAt,
      schedulerSeed: `reset:${resetAt}`,
    })
  }

  return createAchievementsResetCandidate({ playerData })
}
