import { describe, expect, it } from "vitest"
import {
  calculateCycleSnapshotXpPayout,
  getLevelFromXP,
  getLevelProgressFromXP,
  getMinimumReachableXpForLevel,
  getPayoutTierFromXP,
  MAX_BATTLE_XP,
  MAX_SUPPORTED_TOTAL_XP,
  XP_QUANTUM,
} from "./LevelMath"

describe("getLevelFromXP", () => {
  it.each([
    [0, 1],
    [4, 3],
    [8, 5],
    [180, 100],
    [184, 102],
  ])("derives %i XP as Level %i", (totalXp, level) => {
    expect(getLevelFromXP(totalXp)).toBe(level)
  })

  it("continues beyond Level 100 without a cap", () => {
    expect(getLevelFromXP(MAX_SUPPORTED_TOTAL_XP)).toBeGreaterThan(100)
  })

  it.each([-1, 0.5, MAX_SUPPORTED_TOTAL_XP + 1, Number.MAX_SAFE_INTEGER])(
    "rejects unsupported total XP: %s",
    (totalXp) => {
      expect(() => getLevelFromXP(totalXp)).toThrow("Unsupported total XP")
    },
  )

  it("remains monotonic across every reachable XP quantum near Level 100", () => {
    const reachableTotals = Array.from(
      { length: 12 },
      (_unused, index) => 160 + index * XP_QUANTUM,
    )

    for (let index = 1; index < reachableTotals.length; index += 1) {
      expect(getLevelFromXP(reachableTotals[index])).toBeGreaterThan(
        getLevelFromXP(reachableTotals[index - 1]),
      )
    }
  })
})

describe("getMinimumReachableXpForLevel", () => {
  it.each([
    [1, 0],
    [5, 8],
    [10, 20],
    [25, 44],
    [37, 68],
    [50, 92],
    [77, 140],
    [100, 180],
  ])(
    "derives Level %i from a minimum of %i reachable XP",
    (level, minimumXp) => {
      expect(getMinimumReachableXpForLevel(level)).toBe(minimumXp)
    },
  )

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER])(
    "rejects an unsupported Level: %s",
    (level) => {
      expect(() => getMinimumReachableXpForLevel(level)).toThrow(
        "Unsupported Level",
      )
    },
  )
})

describe("getLevelProgressFromXP", () => {
  it.each([
    [0, 1, 0, 2],
    [4, 3, 0, 2],
    [12, 7, 1, 2],
    [180, 100, 0, 2],
  ])(
    "projects %i total XP as Level %i with %i of %i XP earned",
    (totalXp, level, earnedXpTowardNextLevel, requiredXpForNextLevel) => {
      expect(getLevelProgressFromXP(totalXp)).toEqual({
        level,
        earnedXpTowardNextLevel,
        requiredXpForNextLevel,
      })
    },
  )

  it("preserves exact integral progress at the supported XP boundary", () => {
    const progress = getLevelProgressFromXP(MAX_SUPPORTED_TOTAL_XP)

    expect(Number.isSafeInteger(progress.earnedXpTowardNextLevel)).toBe(true)
    expect(progress.earnedXpTowardNextLevel).toBeLessThan(
      progress.requiredXpForNextLevel,
    )
  })
})

describe("cycle-snapshot payout math", () => {
  it.each([
    [0, 1],
    [4, 2],
    [420, 15],
    [33_540, 130],
  ])("derives %i total XP as payout tier %i", (totalXp, payoutTier) => {
    expect(getPayoutTierFromXP(totalXp)).toBe(payoutTier)
  })

  it.each([
    [1, 4],
    [15, 60],
    [100, 400],
    [130, 400],
  ])("maps payout tier %i to %i XP", (payoutTier, payout) => {
    expect(calculateCycleSnapshotXpPayout(payoutTier)).toBe(payout)
  })

  it("defines four-XP awards with a hard 400-XP maximum", () => {
    expect(XP_QUANTUM).toBe(4)
    expect(MAX_BATTLE_XP).toBe(400)
    expect(MAX_SUPPORTED_TOTAL_XP % XP_QUANTUM).toBe(0)
  })

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid snapshotted payout tier: %s",
    (payoutTier) => {
      expect(() => calculateCycleSnapshotXpPayout(payoutTier)).toThrow(
        "Invalid cycle-snapshot opponent payout tier",
      )
    },
  )
})
