import { describe, expect, it } from "vitest"
import { createInitialBattleCycle } from "./BattleCycle"
import { createBattleId } from "./BattleIdentity"
import {
  advanceSchedulerCursor,
  createSchedulerRestorePoint,
} from "./PairScheduler"

describe("Battle Identity", () => {
  it("is stable for the same complete scheduler identity", () => {
    const battleCycle = createInitialBattleCycle("battle-identity-seed")

    expect(createBattleId(battleCycle.scheduler)).toBe(
      createBattleId({ ...battleCycle.scheduler }),
    )
  })

  it("changes for a different cursor cycle deck revision or generation", () => {
    const battleCycle = createInitialBattleCycle("battle-identity-fields-seed")
    const advancedScheduler = advanceSchedulerCursor(
      battleCycle.activeDeck,
      battleCycle.scheduler,
    )
    if (!advancedScheduler) {
      throw new Error("Initial scheduler cannot already be complete")
    }
    const variants = [
      advancedScheduler,
      createSchedulerRestorePoint({
        activeDeck: battleCycle.activeDeck,
        progressGeneration: 0,
        deckRevision: 0,
        seed: battleCycle.scheduler.seed,
        cycleIndex: 1,
      }),
      createSchedulerRestorePoint({
        activeDeck: battleCycle.activeDeck,
        progressGeneration: 0,
        deckRevision: 1,
        seed: battleCycle.scheduler.seed,
        cycleIndex: 0,
      }),
      createSchedulerRestorePoint({
        activeDeck: battleCycle.activeDeck,
        progressGeneration: 1,
        deckRevision: 0,
        seed: battleCycle.scheduler.seed,
        cycleIndex: 0,
      }),
    ]
    const initialBattleId = createBattleId(battleCycle.scheduler)

    expect(new Set(variants.map(createBattleId)).size).toBe(variants.length)
    expect(variants.map(createBattleId)).not.toContain(initialBattleId)
  })
})
