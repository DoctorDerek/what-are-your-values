import { getLevelFromXP } from "@game/utils/src/LevelMath"
import {
  ACHIEVEMENT_CATALOG,
  type AchievementDefinition,
  type AchievementId,
} from "./AchievementCatalog"
import {
  getPendingAchievementUnlocks,
  type AchievementState,
} from "./AchievementState"
import type { BattleProfile } from "./BattleProfile"

const englishNumberFormatter = new Intl.NumberFormat("en-US")
const englishUnlockedDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
})

export type AchievementEnglishCopy = Readonly<{
  title: string
  requirement: string
}>

export type AchievementProgressPresentation =
  | Readonly<{
      kind: "numeric"
      current: number
      target: number
      label: string
    }>
  | Readonly<{
      kind: "eligibility"
      label: string
    }>

export type AchievementPresentation = Readonly<{
  id: AchievementId
  title: string
  requirement: string
  status: "locked" | "unlocked"
  progress: AchievementProgressPresentation | null
  unlockedAt: string | null
  unlockedDate: string | null
}>

export function getPendingAchievementPresentation({
  achievementState,
  achievementPresentations,
}: {
  readonly achievementState: AchievementState
  readonly achievementPresentations: readonly AchievementPresentation[]
}) {
  const pendingAchievementId =
    getPendingAchievementUnlocks(achievementState)[0]?.id
  if (!pendingAchievementId) return null

  const presentation = achievementPresentations.find(
    ({ id }) => id === pendingAchievementId,
  )
  if (!presentation)
    throw new Error("Pending achievement presentation is unavailable")

  return presentation
}

export function getAchievementEnglishCopy(
  achievement: AchievementDefinition,
): AchievementEnglishCopy {
  const { condition } = achievement
  if (condition.kind === "battleCount") {
    const formattedThreshold = englishNumberFormatter.format(
      condition.threshold,
    )

    return Object.freeze({
      title:
        condition.threshold === 1
          ? "First Battle"
          : `${formattedThreshold} Battles`,
      requirement:
        condition.threshold === 1
          ? "Compare your first pair of values."
          : `Compare ${formattedThreshold} pairs of values.`,
    })
  }
  if (condition.kind === "topFive") {
    return Object.freeze({
      title: "Reveal Your Top Five",
      requirement:
        "Reach the first moment when at least five different values have earned XP and the Hub can display a player-produced Top Five.",
    })
  }

  const formattedThreshold = englishNumberFormatter.format(condition.threshold)

  return Object.freeze({
    title: `Reach Level ${formattedThreshold}`,
    requirement: `Raise any value to Level ${formattedThreshold}.`,
  })
}

export function formatAchievementUnlockedDate(timestamp: string) {
  return englishUnlockedDateFormatter.format(new Date(timestamp))
}

function createNumericProgress({
  current,
  target,
  label,
}: {
  readonly current: number
  readonly target: number
  readonly label: string
}): AchievementProgressPresentation {
  return Object.freeze({ kind: "numeric", current, target, label })
}

function getValueLevelProgress({
  threshold,
  achievementState,
  battleProfile,
}: {
  readonly threshold: number
  readonly achievementState: AchievementState
  readonly battleProfile: BattleProfile
}): AchievementProgressPresentation {
  const eligibleLevels = battleProfile.activeDeck.valueIds.flatMap(
    (valueId) => {
      const baselineLevel =
        achievementState.progress.baselineLevelsByValue.get(valueId)
      const valueProgress = battleProfile.progressById.get(valueId)
      if (baselineLevel === undefined || !valueProgress)
        throw new Error(
          `Achievement progress is unavailable for active value: ${valueId}`,
        )

      const currentLevel = getLevelFromXP(valueProgress.totalXp)
      return baselineLevel < threshold && currentLevel < threshold
        ? [currentLevel]
        : []
    },
  )
  if (eligibleLevels.length === 0) {
    return Object.freeze({
      kind: "eligibility",
      label: `No active value is currently eligible to cross Level ${englishNumberFormatter.format(threshold)}.`,
    })
  }

  const current = Math.max(...eligibleLevels)
  const formattedCurrent = englishNumberFormatter.format(current)
  const formattedTarget = englishNumberFormatter.format(threshold)

  return createNumericProgress({
    current,
    target: threshold,
    label: `Highest eligible value: Level ${formattedCurrent} of Level ${formattedTarget}`,
  })
}

function getLockedAchievementProgress({
  achievement,
  achievementState,
  battleProfile,
}: {
  readonly achievement: AchievementDefinition
  readonly achievementState: AchievementState
  readonly battleProfile: BattleProfile
}): AchievementProgressPresentation {
  const { condition } = achievement
  if (condition.kind === "battleCount") {
    const current = Math.min(
      achievementState.progress.lifetimeBattleCount,
      condition.threshold,
    )

    return createNumericProgress({
      current,
      target: condition.threshold,
      label: `${englishNumberFormatter.format(current)} of ${englishNumberFormatter.format(condition.threshold)} comparisons`,
    })
  }
  if (condition.kind === "topFive") {
    const valuesWithExperience = Array.from(
      battleProfile.progressById.values(),
    ).filter(({ totalXp }) => totalXp > 0).length
    if (
      achievementState.progress.topFiveAlreadyRevealedAtReset ||
      valuesWithExperience >= 5
    ) {
      return Object.freeze({
        kind: "eligibility",
        label:
          "Reset Levels & Experience before revealing your Top Five again.",
      })
    }

    return createNumericProgress({
      current: valuesWithExperience,
      target: 5,
      label: `${valuesWithExperience} of 5 values have earned XP`,
    })
  }

  return getValueLevelProgress({
    threshold: condition.threshold,
    achievementState,
    battleProfile,
  })
}

export function projectAchievementCatalog({
  achievementState,
  battleProfile,
}: {
  readonly achievementState: AchievementState
  readonly battleProfile: BattleProfile
}) {
  const unlockById = new Map(
    achievementState.unlocks.map((unlock) => [unlock.id, unlock]),
  )

  return Object.freeze(
    ACHIEVEMENT_CATALOG.map((achievement) => {
      const copy = getAchievementEnglishCopy(achievement)
      const unlock = unlockById.get(achievement.id)

      return Object.freeze({
        id: achievement.id,
        ...copy,
        status: unlock ? "unlocked" : "locked",
        progress: unlock
          ? null
          : getLockedAchievementProgress({
              achievement,
              achievementState,
              battleProfile,
            }),
        unlockedAt: unlock?.unlockedAt ?? null,
        unlockedDate: unlock
          ? formatAchievementUnlockedDate(unlock.unlockedAt)
          : null,
      }) satisfies AchievementPresentation
    }),
  )
}
