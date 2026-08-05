import { describe, expect, it } from "vitest"
import {
  ACHIEVEMENT_CATALOG,
  ACHIEVEMENT_COPY_KEYS,
  BATTLE_ACHIEVEMENT_THRESHOLDS,
  getAchievementDefinition,
  isAchievementId,
  readAchievementId,
  VALUE_LEVEL_ACHIEVEMENT_THRESHOLDS,
} from "./AchievementCatalog"

describe("Achievement Catalog", () => {
  it("defines exactly 32 battle, one Top Five, and seven Level achievements", () => {
    expect(BATTLE_ACHIEVEMENT_THRESHOLDS).toEqual([
      1, 5, 10, 25, 37, 50, 77, 100, 200, 300, 400, 500, 600, 700, 777, 800,
      900, 1_000, 1_100, 1_200, 1_300, 1_400, 1_500, 1_600, 1_700, 1_800, 1_900,
      2_000, 2_100, 2_200, 2_300, 2_400,
    ])
    expect(VALUE_LEVEL_ACHIEVEMENT_THRESHOLDS).toEqual([
      5, 10, 25, 37, 50, 77, 100,
    ])
    expect(ACHIEVEMENT_CATALOG).toHaveLength(40)
    expect(new Set(ACHIEVEMENT_CATALOG.map(({ id }) => id))).toHaveLength(40)
  })

  it("keeps stable IDs and exact conditions for each family", () => {
    expect(
      getAchievementDefinition(readAchievementId("battle.first", "ID")),
    ).toMatchObject({
      condition: { kind: "battleCount", threshold: 1 },
      ...ACHIEVEMENT_COPY_KEYS.firstBattle,
    })
    expect(
      getAchievementDefinition(readAchievementId("battle.2400", "ID")),
    ).toMatchObject({
      condition: { kind: "battleCount", threshold: 2_400 },
      ...ACHIEVEMENT_COPY_KEYS.battleCount,
    })
    expect(
      getAchievementDefinition(readAchievementId("topFive.first", "ID")),
    ).toMatchObject({
      condition: { kind: "topFive" },
      ...ACHIEVEMENT_COPY_KEYS.topFive,
    })
    expect(
      getAchievementDefinition(readAchievementId("valueLevel.100", "ID")),
    ).toMatchObject({
      condition: { kind: "valueLevel", threshold: 100 },
      ...ACHIEVEMENT_COPY_KEYS.valueLevel,
    })
  })

  it("accepts only catalog-owned permanent IDs", () => {
    expect(isAchievementId("battle.37")).toBe(true)
    expect(isAchievementId("battle.777")).toBe(true)
    expect(isAchievementId("battle.10000")).toBe(false)
    expect(isAchievementId("cycle.first")).toBe(false)
    expect(isAchievementId("valueLevel.1")).toBe(false)
    expect(() => readAchievementId("future.unknown", "Achievement ID")).toThrow(
      "Invalid Achievement ID",
    )
  })
})
