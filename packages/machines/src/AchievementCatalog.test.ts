import { describe, expect, it } from "vitest"
import {
  ACHIEVEMENT_COPY_KEYS,
  ACHIEVEMENT_CATALOG,
  getAchievementDefinition,
  HUNDRED_BATTLE_ACHIEVEMENT_THRESHOLDS,
  isAchievementId,
  readAchievementId,
  VALUE_LEVEL_ACHIEVEMENT_THRESHOLDS,
} from "./AchievementCatalog"

describe("Achievement Catalog", () => {
  it("defines the complete literal Phase 0 milestone set", () => {
    expect(HUNDRED_BATTLE_ACHIEVEMENT_THRESHOLDS).toHaveLength(100)
    expect(HUNDRED_BATTLE_ACHIEVEMENT_THRESHOLDS[0]).toBe(100)
    expect(HUNDRED_BATTLE_ACHIEVEMENT_THRESHOLDS.at(-1)).toBe(10_000)
    expect(VALUE_LEVEL_ACHIEVEMENT_THRESHOLDS).toEqual([5, 10, 25, 50, 100])
    expect(ACHIEVEMENT_CATALOG).toHaveLength(109)
    expect(new Set(ACHIEVEMENT_CATALOG.map(({ id }) => id))).toHaveLength(109)
  })

  it("keeps stable IDs and exact conditions for each family", () => {
    expect(
      getAchievementDefinition(readAchievementId("battle.first", "ID")),
    ).toMatchObject({
      condition: { kind: "battleCount", threshold: 1 },
      ...ACHIEVEMENT_COPY_KEYS.firstBattle,
    })
    expect(
      getAchievementDefinition(readAchievementId("battle.10000", "ID")),
    ).toMatchObject({
      condition: { kind: "battleCount", threshold: 10_000 },
      ...ACHIEVEMENT_COPY_KEYS.battleCount,
    })
    expect(
      getAchievementDefinition(readAchievementId("cycle.first", "ID")),
    ).toMatchObject({
      condition: { kind: "cycleComplete" },
      ...ACHIEVEMENT_COPY_KEYS.cycleComplete,
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
    expect(isAchievementId("battle.100")).toBe(true)
    expect(isAchievementId("battle.150")).toBe(false)
    expect(isAchievementId("valueLevel.1")).toBe(false)
    expect(() => readAchievementId("future.unknown", "Achievement ID")).toThrow(
      "Invalid Achievement ID",
    )
  })
})
