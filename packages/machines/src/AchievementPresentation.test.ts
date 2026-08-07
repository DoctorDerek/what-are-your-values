import { describe, expect, it } from "vitest"
import { ACHIEVEMENT_CATALOG } from "./AchievementCatalog"
import {
  formatAchievementUnlockedDate,
  getAchievementEnglishCopy,
} from "./AchievementPresentation"

describe("Achievement presentation", () => {
  it("projects the complete permanent catalog with exact GDD v5.2 English copy", () => {
    expect(
      ACHIEVEMENT_CATALOG.map((achievement) => ({
        id: achievement.id,
        ...getAchievementEnglishCopy(achievement),
      })),
    ).toEqual([
      {
        id: "battle.first",
        title: "First Battle",
        requirement: "Compare your first pair of values.",
      },
      ...[
        5, 10, 25, 37, 50, 77, 100, 200, 300, 400, 500, 600, 700, 777, 800, 900,
        1_000, 1_100, 1_200, 1_300, 1_400, 1_500, 1_600, 1_700, 1_800, 1_900,
        2_000, 2_100, 2_200, 2_300, 2_400,
      ].map((threshold) => ({
        id: `battle.${threshold}`,
        title: `${threshold.toLocaleString("en-US")} Battles`,
        requirement: `Compare ${threshold.toLocaleString("en-US")} pairs of values.`,
      })),
      {
        id: "topFive.first",
        title: "Reveal Your Top Five",
        requirement:
          "Reach the first moment when at least five different values have earned XP and the Hub can display a player-produced Top Five.",
      },
      ...[5, 10, 25, 37, 50, 77, 100].map((threshold) => ({
        id: `valueLevel.${threshold}`,
        title: `Reach Level ${threshold}`,
        requirement: `Raise any value to Level ${threshold}.`,
      })),
    ])
  })

  it("returns immutable copy records and UTC-normalized unlock dates", () => {
    const copy = getAchievementEnglishCopy(ACHIEVEMENT_CATALOG[0]!)

    expect(Object.isFrozen(copy)).toBe(true)
    expect(formatAchievementUnlockedDate("2026-07-29T23:30:00-05:00")).toBe(
      "Jul 30, 2026",
    )
  })
})
