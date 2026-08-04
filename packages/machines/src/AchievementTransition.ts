import { getLevelFromXP } from "@game/utils/src/LevelMath"
import {
  ACHIEVEMENT_CATALOG,
  type AchievementDefinition,
  type AchievementId,
} from "./AchievementCatalog"
import {
  createAchievementState,
  createBoundedBattleIdSet,
  type AchievementState,
  type AchievementUnlock,
} from "./AchievementState"
import type { BattleId } from "./BattleIdentity"
import type { BattleProfile } from "./BattleProfile"
import type { BattleProfileEvent } from "./BattleProfileEvent"

type BattleChoiceAchievementEvent = Extract<
  BattleProfileEvent,
  { readonly type: "battle-choice" }
>

function incrementSafeInteger(value: number, label: string) {
  if (value === Number.MAX_SAFE_INTEGER) {
    throw new Error(`${label} cannot be incremented safely`)
  }

  return value + 1
}

export function getReachableAchievementBattleIds(profile: BattleProfile) {
  return Object.freeze(
    [...profile.history, ...profile.redo].map(({ battleId }) => battleId),
  )
}

function getRebasedBaselineLevelsByValue({
  priorState,
  resultingProfile,
}: {
  readonly priorState: AchievementState
  readonly resultingProfile: BattleProfile
}) {
  return new Map(
    resultingProfile.activeDeck.valueIds.map((valueId) => [
      valueId,
      priorState.progress.baselineLevelsByValue.get(valueId) ?? 1,
    ]),
  )
}

export function hasEarnedTopFive(profile: BattleProfile) {
  return (
    Array.from(profile.progressById.values()).filter(
      ({ totalXp }) => totalXp > 0,
    ).length >= 5
  )
}

function createAchievementEventToken(
  achievementId: AchievementId,
  battleId: BattleId,
) {
  return JSON.stringify(["achievement-event-v1", achievementId, battleId])
}

function getNewlySatisfiedAchievements({
  priorState,
  priorProfile,
  resultingProfile,
  event,
  lifetimeBattleCount,
  isNewBattle,
}: {
  readonly priorState: AchievementState
  readonly priorProfile: BattleProfile
  readonly resultingProfile: BattleProfile
  readonly event: BattleChoiceAchievementEvent
  readonly lifetimeBattleCount: number
  readonly isNewBattle: boolean
}) {
  const unlockedIds = new Set(priorState.unlocks.map(({ id }) => id))
  const priorWinnerProgress = priorProfile.progressById.get(
    event.delta.winnerId,
  )
  const resultingWinnerProgress = resultingProfile.progressById.get(
    event.delta.winnerId,
  )
  if (!priorWinnerProgress || !resultingWinnerProgress) {
    throw new Error("Achievement transition winner progress is unavailable")
  }

  const priorWinnerLevel = getLevelFromXP(priorWinnerProgress.totalXp)
  const resultingWinnerLevel = getLevelFromXP(resultingWinnerProgress.totalXp)
  const winnerBaselineLevel = priorState.progress.baselineLevelsByValue.get(
    event.delta.winnerId,
  )
  if (winnerBaselineLevel === undefined) {
    throw new Error("Achievement transition winner baseline is unavailable")
  }

  return ACHIEVEMENT_CATALOG.filter((achievement) => {
    if (unlockedIds.has(achievement.id)) {
      return false
    }

    return isAchievementSatisfied({
      achievement,
      priorState,
      priorProfile,
      resultingProfile,
      event,
      lifetimeBattleCount,
      isNewBattle,
      priorWinnerLevel,
      resultingWinnerLevel,
      winnerBaselineLevel,
    })
  })
}

function isAchievementSatisfied({
  achievement,
  priorState,
  priorProfile,
  resultingProfile,
  event,
  lifetimeBattleCount,
  isNewBattle,
  priorWinnerLevel,
  resultingWinnerLevel,
  winnerBaselineLevel,
}: {
  readonly achievement: AchievementDefinition
  readonly priorState: AchievementState
  readonly priorProfile: BattleProfile
  readonly resultingProfile: BattleProfile
  readonly event: BattleChoiceAchievementEvent
  readonly lifetimeBattleCount: number
  readonly isNewBattle: boolean
  readonly priorWinnerLevel: number
  readonly resultingWinnerLevel: number
  readonly winnerBaselineLevel: number
}) {
  const { condition } = achievement
  if (condition.kind === "battleCount") {
    return isNewBattle && lifetimeBattleCount === condition.threshold
  }
  if (condition.kind === "topFive") {
    return (
      !priorState.progress.topFiveAlreadyRevealedAtReset &&
      !hasEarnedTopFive(priorProfile) &&
      hasEarnedTopFive(resultingProfile)
    )
  }

  return (
    winnerBaselineLevel < condition.threshold &&
    priorWinnerLevel < condition.threshold &&
    resultingWinnerLevel >= condition.threshold
  )
}

function createNewUnlocks({
  achievements,
  battleId,
  unlockedAt,
}: {
  readonly achievements: readonly AchievementDefinition[]
  readonly battleId: BattleId
  readonly unlockedAt: string
}) {
  return achievements.map(
    ({ id }) =>
      Object.freeze({
        id,
        unlockedAt,
        eventToken: createAchievementEventToken(id, battleId),
      }) satisfies AchievementUnlock,
  )
}

function applyBattleChoiceAchievementTransition({
  state,
  priorProfile,
  resultingProfile,
  event,
  occurredAt,
}: {
  readonly state: AchievementState
  readonly priorProfile: BattleProfile
  readonly resultingProfile: BattleProfile
  readonly event: BattleChoiceAchievementEvent
  readonly occurredAt: string
}) {
  const isNewBattle = !state.progress.countedBattleWindow.ids.includes(
    event.delta.battleId,
  )
  const lifetimeBattleCount = isNewBattle
    ? incrementSafeInteger(
        state.progress.lifetimeBattleCount,
        "Achievement lifetime battle count",
      )
    : state.progress.lifetimeBattleCount
  const completedCycleCount =
    isNewBattle && event.delta.cycleBoundary
      ? incrementSafeInteger(
          state.progress.completedCycleCount,
          "Achievement completed-cycle count",
        )
      : state.progress.completedCycleCount
  const newlySatisfiedAchievements = getNewlySatisfiedAchievements({
    priorState: state,
    priorProfile,
    resultingProfile,
    event,
    lifetimeBattleCount,
    isNewBattle,
  })

  return createAchievementState({
    activeDeck: resultingProfile.activeDeck,
    unlocks: [
      ...state.unlocks,
      ...createNewUnlocks({
        achievements: newlySatisfiedAchievements,
        battleId: event.delta.battleId,
        unlockedAt: occurredAt,
      }),
    ],
    presentedAchievementIds: state.presentedAchievementIds,
    progress: {
      ...state.progress,
      lifetimeBattleCount,
      completedCycleCount,
      countedBattleWindow: createBoundedBattleIdSet(
        getReachableAchievementBattleIds(resultingProfile),
      ),
    },
  })
}

export function applyAchievementTransition({
  state,
  priorProfile,
  resultingProfile,
  event,
  occurredAt,
}: {
  readonly state: AchievementState
  readonly priorProfile: BattleProfile
  readonly resultingProfile: BattleProfile
  readonly event: BattleProfileEvent
  readonly occurredAt: string
}) {
  if (event.type === "battle-choice") {
    return applyBattleChoiceAchievementTransition({
      state,
      priorProfile,
      resultingProfile,
      event,
      occurredAt,
    })
  }

  return createAchievementState({
    activeDeck: resultingProfile.activeDeck,
    unlocks: state.unlocks,
    presentedAchievementIds: state.presentedAchievementIds,
    progress: {
      ...state.progress,
      baselineLevelsByValue:
        event.type === "deck-revision"
          ? getRebasedBaselineLevelsByValue({
              priorState: state,
              resultingProfile,
            })
          : state.progress.baselineLevelsByValue,
      countedBattleWindow: createBoundedBattleIdSet(
        getReachableAchievementBattleIds(resultingProfile),
      ),
    },
  })
}
