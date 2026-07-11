import { describe, expect, it } from "vitest"

import { calculateXPPayout, getLevelFromXP } from "./LevelMath"

describe("getLevelFromXP", () => {
  it("returns level 1 for zero XP", () => {
    expect(getLevelFromXP(0)).toBe(1)
  })

  it("returns level 1 for negative XP", () => {
    expect(getLevelFromXP(-100)).toBe(1)
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
    const level = getLevelFromXP(10000)
    expect(level).toBeGreaterThan(100)
    expect(Number.isFinite(level)).toBe(true)
  })

  it("increases monotonically across boundary values", () => {
    const boundaries = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55]
    for (let i = 1; i < boundaries.length; i++) {
      expect(getLevelFromXP(boundaries[i])).toBeGreaterThan(
        getLevelFromXP(boundaries[i - 1]),
      )
    }
  })
})

describe("calculateXPPayout", () => {
  it("returns minimum payout of 1 for zero XP loser", () => {
    expect(calculateXPPayout(0)).toBe(1)
  })

  it("returns loser level as payout for mid-range values", () => {
    expect(calculateXPPayout(3)).toBe(3)
    expect(calculateXPPayout(10)).toBe(5)
  })

  it("caps payout at 100 for extremely high-level losers", () => {
    expect(calculateXPPayout(1000000)).toBe(100)
  })

  it("never returns less than 1", () => {
    expect(calculateXPPayout(-999)).toBeGreaterThanOrEqual(1)
  })
})
