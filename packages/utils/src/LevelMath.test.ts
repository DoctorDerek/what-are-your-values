import { describe, expect, it } from "vitest"
import {
  calculateCycleSnapshotXpPayout,
  getLevelFromXP,
  MAX_SUPPORTED_TOTAL_XP,
} from "./LevelMath"

describe("getLevelFromXP", () => {
  it("returns level 1 for zero XP", () => {
    expect(getLevelFromXP(0)).toBe(1)
  })

  it("returns level 2 for 1 XP (triangular number threshold)", () => {
    expect(getLevelFromXP(1)).toBe(2)
  })

  it("returns level 3 for 3 XP", () => {
    expect(getLevelFromXP(3)).toBe(3)
  })

  it("returns level 4 for 6 XP", () => {
    expect(getLevelFromXP(6)).toBe(4)
  })

  it("returns level 5 for 10 XP", () => {
    expect(getLevelFromXP(10)).toBe(5)
  })

  it("handles large XP values without overflow", () => {
    const level = getLevelFromXP(MAX_SUPPORTED_TOTAL_XP)
    expect(level).toBeGreaterThan(100)
    expect(Number.isFinite(level)).toBe(true)
  })

  it.each([-1, 0.5, MAX_SUPPORTED_TOTAL_XP + 1, Number.MAX_SAFE_INTEGER])(
    "rejects unsupported total XP: %s",
    (totalXp) => {
      expect(() => getLevelFromXP(totalXp)).toThrow("Unsupported total XP")
    },
  )

  it("increases monotonically across boundary values", () => {
    const boundaries = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55]
    for (let i = 1; i < boundaries.length; i++) {
      expect(getLevelFromXP(boundaries[i])).toBeGreaterThan(
        getLevelFromXP(boundaries[i - 1]),
      )
    }
  })
})

describe("calculateCycleSnapshotXpPayout", () => {
  it.each([
    [1, 1],
    [15, 15],
    [100, 100],
    [130, 100],
  ])("maps a snapshotted level of %i to %i XP", (level, payout) => {
    expect(calculateCycleSnapshotXpPayout(level)).toBe(payout)
  })

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid snapshotted level: %s",
    (level) => {
      expect(() => calculateCycleSnapshotXpPayout(level)).toThrow(
        "Invalid cycle-snapshot opponent level",
      )
    },
  )
})
