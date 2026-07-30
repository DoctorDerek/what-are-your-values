import { getLevelFromXP } from "@game/utils/src/LevelMath"
import type { AchievementDefinition } from "./AchievementCatalog"
import type { AchievementState } from "./AchievementState"
import type { BattleProfile } from "./BattleProfile"

export function formatAchievementUnlockedDate(timestamp: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(timestamp))
}

export function getAchievementProgress({
  achievement,
  achievementState,
  battleProfile,
}: {
  readonly achievement: AchievementDefinition
  readonly achievementState: AchievementState
  readonly battleProfile: BattleProfile
}) {
  const { condition } = achievement
  if (condition.kind === "battle-count") {
    return `${Math.min(
      achievementState.progress.lifetimeBattleCount,
      condition.threshold,
    ).toLocaleString("en-US")} of ${condition.threshold.toLocaleString(
      "en-US",
    )} comparisons`
  }
  if (condition.kind === "cycle-complete") {
    return `${Math.min(
      achievementState.progress.completedCycleCount,
      1,
    )} of 1 pair cycles`
  }
  if (condition.kind === "top-five") {
    const valuesWithExperience = Array.from(
      battleProfile.progressById.values(),
    ).filter(({ totalXp }) => totalXp > 0).length
    return `${Math.min(valuesWithExperience, 5)} of 5 values at Level 2`
  }

  const highestLevel = Math.max(
    ...Array.from(battleProfile.progressById.values(), ({ totalXp }) =>
      getLevelFromXP(totalXp),
    ),
  )
  return `Highest value: Level ${highestLevel} of Level ${condition.threshold}`
}
