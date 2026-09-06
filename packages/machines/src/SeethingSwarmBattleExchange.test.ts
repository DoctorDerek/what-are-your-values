import { describe, expect, it } from "vitest"
import { createSeethingSwarmBattleTravel } from "./SeethingSwarmBattleExchange"

describe("directed animal battle travel", () => {
  it.each([
    { attacker: { x: 0, y: 0 }, defender: { x: 200, y: 0 } },
    { attacker: { x: 200, y: 0 }, defender: { x: 0, y: 0 } },
    { attacker: { x: 50, y: 0 }, defender: { x: 100, y: 200 } },
    { attacker: { x: 100, y: 200 }, defender: { x: 50, y: 0 } },
  ])("approaches the opponent without crossing its center: $attacker -> $defender", ({ attacker, defender }) => {
    const travel = createSeethingSwarmBattleTravel({ attacker, defender })
    const remainingDistance = Math.hypot(defender.x - attacker.x - travel.x, defender.y - attacker.y - travel.y)
    expect(remainingDistance).toBeCloseTo(56, 0)
    expect(Number.isInteger(travel.x)).toBe(true)
    expect(Number.isInteger(travel.y)).toBe(true)
  })

  it.each([{ x: 0, y: 0 }, { x: 20, y: 10 }])("does not invent travel when animals are already in contact", (defender) => {
    expect(createSeethingSwarmBattleTravel({ attacker: { x: 0, y: 0 }, defender })).toEqual({ x: 0, y: 0 })
  })
})
