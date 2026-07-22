import type { ValueId } from "@game/data/src/Value"
import {
  createValueProgressById,
  type ValueProgress,
} from "@game/data/src/ValueProgress"
import { describe, expect, it } from "vitest"
import {
  createBattleCycleCandidate,
  createInitialBattleCycle,
  type BattleCycleState,
} from "./BattleCycle"
import { redoBattleDelta, undoBattleDelta } from "./BattleDeltaTransition"
import { projectScheduledPair } from "./PairScheduler"

function createProgress(
  totalXp: number,
  profileWins: number,
  profileComparisons: number,
  currentCycleWins: number,
): ValueProgress {
  return {
    totalXp,
    profileWins,
    profileComparisons,
    currentCycleWins,
  }
}

function replaceProgress(
  battleCycle: BattleCycleState,
  replacements: ReadonlyMap<ValueId, ValueProgress>,
) {
  return createValueProgressById(
    battleCycle.activeDeck,
    battleCycle.activeDeck.valueIds.map((valueId) => {
      const progress =
        replacements.get(valueId) ?? battleCycle.progressById.get(valueId)

      if (!progress) {
        throw new Error(`Value Progress is missing ${valueId}`)
      }

      return [valueId, progress]
    }),
  )
}

function expectBattleCycleToEqual(
  actual: BattleCycleState,
  expected: BattleCycleState,
) {
  expect(actual.activeDeck).toBe(expected.activeDeck)
  expect(Array.from(actual.progressById)).toEqual(
    Array.from(expected.progressById),
  )
  expect(Array.from(actual.cycleLevelSnapshot)).toEqual(
    Array.from(expected.cycleLevelSnapshot),
  )
  expect(actual.scheduler).toEqual(expected.scheduler)
}

describe("Battle Delta transitions", () => {
  it("round-trips one ordinary battle exactly without recalculating its stored payout", () => {
    const initialBattleCycle = createInitialBattleCycle(
      "ordinary-delta-transition-seed",
    )
    const [winnerId, loserId] = projectScheduledPair(
      initialBattleCycle.activeDeck,
      initialBattleCycle.scheduler,
    ).pair
    const progressById = replaceProgress(
      initialBattleCycle,
      new Map([
        [winnerId, createProgress(6, 3, 5, 2)],
        [loserId, createProgress(210, 7, 12, 1)],
      ]),
    )
    const cycleLevelSnapshot = new Map(initialBattleCycle.cycleLevelSnapshot)
    cycleLevelSnapshot.set(loserId, 15)
    const battleCycle = Object.freeze({
      ...initialBattleCycle,
      progressById,
      cycleLevelSnapshot,
    }) satisfies BattleCycleState
    const priorProgressEntries = Array.from(battleCycle.progressById)
    const priorSnapshotEntries = Array.from(battleCycle.cycleLevelSnapshot)
    const candidate = createBattleCycleCandidate({
      battleCycle,
      winnerId,
      expectedScheduler: battleCycle.scheduler,
    })
    const resultingProgressEntries = Array.from(candidate.progressById)

    expect(candidate.delta.xpGained).toBe(15)

    const undone = undoBattleDelta({
      battleCycle: candidate,
      delta: candidate.delta,
    })
    const redone = redoBattleDelta({
      battleCycle: undone,
      delta: candidate.delta,
    })

    expectBattleCycleToEqual(undone, battleCycle)
    expectBattleCycleToEqual(redone, candidate)
    expect(undone.progressById).not.toBe(candidate.progressById)
    expect(redone.progressById).not.toBe(undone.progressById)
    expect(Object.isFrozen(undone)).toBe(true)
    expect(Object.isFrozen(redone)).toBe(true)
    expect(Array.from(battleCycle.progressById)).toEqual(priorProgressEntries)
    expect(Array.from(battleCycle.cycleLevelSnapshot)).toEqual(
      priorSnapshotEntries,
    )
    expect(Array.from(candidate.progressById)).toEqual(resultingProgressEntries)
  })
})
