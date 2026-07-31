import { describe, expect, it } from "vitest"
import { createInitialBattleCycle } from "./BattleCycle"
import {
  createBattleId,
  createCycleCompleteEventId,
  readBattleId,
} from "./BattleIdentity"
import {
  advanceSchedulerCursor,
  createSchedulerRestorePoint,
} from "./PairScheduler"

describe("Battle Identity", () => {
  it("serializes the exact seed-independent v5.0 identity tuple", () => {
    const battleCycle = createInitialBattleCycle("battle-identity-seed")
    const schedulerWithDifferentSeed = createSchedulerRestorePoint({
      activeDeck: battleCycle.activeDeck,
      progressGeneration: battleCycle.scheduler.progressGeneration,
      deckRevision: battleCycle.scheduler.deckRevision,
      seed: "different-restore-only-seed",
      cycleIndex: battleCycle.scheduler.cycleIndex,
      cursor: battleCycle.scheduler.cursor,
    })
    const battleId = createBattleId(battleCycle.scheduler)

    expect(JSON.parse(battleId)).toEqual([
      "battle-v1",
      battleCycle.scheduler.progressGeneration,
      battleCycle.scheduler.deckRevision,
      battleCycle.scheduler.activeDeckFingerprint,
      battleCycle.scheduler.algorithmVersion,
      battleCycle.scheduler.scheduleKind,
      battleCycle.scheduler.cycleIndex,
      battleCycle.scheduler.cursor,
    ])
    expect(createBattleId(schedulerWithDifferentSeed)).toBe(battleId)
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

  it("derives one stable cycle-complete event from the final battle identity", () => {
    const battleCycle = createInitialBattleCycle("cycle-event-identity-seed")
    const battleId = createBattleId(battleCycle.scheduler)

    expect(createCycleCompleteEventId(battleId)).toBe(
      createCycleCompleteEventId(battleId),
    )
    expect(createCycleCompleteEventId(battleId)).not.toBe(battleId)
  })

  it("reads only canonical battle identities with supported scheduler fields", () => {
    const battleCycle = createInitialBattleCycle(
      "persisted-battle-identity-seed",
    )
    const battleId = createBattleId(battleCycle.scheduler)

    expect(readBattleId(battleId, "Battle ID")).toBe(battleId)
    expect(() => readBattleId(null, "Battle ID")).toThrow("Invalid Battle ID")
    expect(() => readBattleId("not-json", "Battle ID")).toThrow(
      "Invalid Battle ID",
    )
    expect(() =>
      readBattleId(JSON.stringify(["battle-v1"]), "Battle ID"),
    ).toThrow("Invalid Battle ID")
    expect(() =>
      readBattleId(
        battleId.replace('"full-cycle"', '"future-schedule"'),
        "Battle ID",
      ),
    ).toThrow("Invalid Battle ID")
    expect(() => readBattleId(` ${battleId}`, "Battle ID")).toThrow(
      "Invalid Battle ID",
    )
    expect(() =>
      readBattleId(
        JSON.stringify([
          "battle-v1",
          battleCycle.scheduler.progressGeneration,
          battleCycle.scheduler.deckRevision,
          battleCycle.scheduler.activeDeckFingerprint,
          battleCycle.scheduler.algorithmVersion,
          battleCycle.scheduler.scheduleKind,
          battleCycle.scheduler.seed,
          battleCycle.scheduler.cycleIndex,
          battleCycle.scheduler.cursor,
        ]),
        "Battle ID",
      ),
    ).toThrow("Invalid Battle ID")
  })
})
