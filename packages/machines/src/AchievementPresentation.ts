import type { AchievementDefinition } from "./AchievementCatalog"

const englishNumberFormatter = new Intl.NumberFormat("en-US")
const englishUnlockedDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
})

export type AchievementEnglishCopy = Readonly<{
  title: string
  requirement: string
}>

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
