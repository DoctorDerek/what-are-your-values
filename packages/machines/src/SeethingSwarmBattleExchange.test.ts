import { describe, expect, it } from "vitest"
import { createSeethingSwarmBattleTravel } from "./SeethingSwarmBattleExchange"

describe("directed animal battle travel", () => {
  it.each([
    {
      attackerSide: "first",
      attacker: { x: 0, y: 0 },
      defender: { x: 300, y: 0 },
      combatantWidth: 224,
    },
    {
      attackerSide: "second",
      attacker: { x: 300, y: 0 },
      defender: { x: 0, y: 0 },
      combatantWidth: 224,
    },
    {
      attackerSide: "first",
      attacker: { x: 70, y: 0 },
      defender: { x: 290, y: 400 },
      combatantWidth: 112,
    },
    {
      attackerSide: "second",
      attacker: { x: 290, y: 400 },
      defender: { x: 70, y: 0 },
      combatantWidth: 112,
    },
    {
      attackerSide: "first",
      attacker: { x: 0, y: 0 },
      defender: { x: 0, y: 0 },
      combatantWidth: 112,
    },
  ] as const)(
    "ends on the opponent baseline with room for both animals: $attackerSide",
    (input) => {
      const travel = createSeethingSwarmBattleTravel(input)
      expect(input.attacker.y + travel.y).toBe(input.defender.y)
      expect(input.defender.x - input.attacker.x - travel.x).toBe(
        ((input.combatantWidth * 3) / 4) *
          (input.attackerSide === "first" ? 1 : -1),
      )
      expect(Number.isInteger(travel.x)).toBe(true)
      expect(Number.isInteger(travel.y)).toBe(true)
    },
  )
})
