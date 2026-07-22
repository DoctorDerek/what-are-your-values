import { getPairCount } from "@game/data/src/ActiveDeck"
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
import type { BattleDelta } from "./BattleDelta"
import {
  redoBattleDelta,
  undoBattleDelta,
  validateBattleDelta,
} from "./BattleDeltaTransition"
import {
  createSchedulerRestorePoint,
  projectScheduledPair,
} from "./PairScheduler"

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

    expect(validateBattleDelta(candidate.activeDeck, candidate.delta)).toEqual(
      candidate.delta,
    )

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

  it("round-trips the final pair across exact cycle snapshots and current-win maps", () => {
    const initialBattleCycle = createInitialBattleCycle(
      "boundary-delta-transition-seed",
    )
    const finalScheduler = createSchedulerRestorePoint({
      activeDeck: initialBattleCycle.activeDeck,
      progressGeneration: initialBattleCycle.scheduler.progressGeneration,
      deckRevision: initialBattleCycle.scheduler.deckRevision,
      seed: initialBattleCycle.scheduler.seed,
      cycleIndex: initialBattleCycle.scheduler.cycleIndex,
      cursor: getPairCount(initialBattleCycle.activeDeck.valueIds.length) - 1,
    })
    const [winnerId, loserId] = projectScheduledPair(
      initialBattleCycle.activeDeck,
      finalScheduler,
    ).pair
    const otherValueId = initialBattleCycle.activeDeck.valueIds.find(
      (valueId) => valueId !== winnerId && valueId !== loserId,
    )

    if (!otherValueId) {
      throw new Error("Boundary transition fixture requires another value")
    }

    const progressById = replaceProgress(
      initialBattleCycle,
      new Map([
        [winnerId, createProgress(6, 3, 5, 2)],
        [loserId, createProgress(210, 7, 12, 1)],
        [otherValueId, createProgress(5, 2, 4, 2)],
      ]),
    )
    const cycleLevelSnapshot = new Map(initialBattleCycle.cycleLevelSnapshot)
    cycleLevelSnapshot.set(loserId, 15)
    const battleCycle = Object.freeze({
      ...initialBattleCycle,
      progressById,
      cycleLevelSnapshot,
      scheduler: finalScheduler,
    }) satisfies BattleCycleState
    const candidate = createBattleCycleCandidate({
      battleCycle,
      winnerId,
      expectedScheduler: finalScheduler,
    })
    const boundary = candidate.delta.cycleBoundary

    if (!boundary) {
      throw new Error("Final pair did not create a cycle-boundary transition")
    }

    const undone = undoBattleDelta({
      battleCycle: candidate,
      delta: candidate.delta,
    })
    const redone = redoBattleDelta({
      battleCycle: undone,
      delta: candidate.delta,
    })

    expect(candidate.delta.xpGained).toBe(15)
    expect(candidate.delta.resultingWinnerProgress.currentCycleWins).toBe(3)
    expect(candidate.progressById.get(winnerId)?.currentCycleWins).toBe(0)
    expect(
      Array.from(candidate.progressById.values()).every(
        ({ currentCycleWins }) => currentCycleWins === 0,
      ),
    ).toBe(true)
    expectBattleCycleToEqual(undone, battleCycle)
    expectBattleCycleToEqual(redone, candidate)
    expect(undone.progressById.get(winnerId)?.currentCycleWins).toBe(2)
    expect(undone.progressById.get(loserId)?.currentCycleWins).toBe(1)
    expect(undone.progressById.get(otherValueId)?.currentCycleWins).toBe(2)
    expect(Array.from(undone.cycleLevelSnapshot)).toEqual(
      Array.from(boundary.priorCycleLevelSnapshot),
    )
    expect(Array.from(redone.cycleLevelSnapshot)).toEqual(
      Array.from(boundary.resultingCycleLevelSnapshot),
    )
    expect(undone.cycleLevelSnapshot).not.toBe(boundary.priorCycleLevelSnapshot)
    expect(redone.cycleLevelSnapshot).not.toBe(
      boundary.resultingCycleLevelSnapshot,
    )
    const retainedPriorWinnerLevel =
      boundary.priorCycleLevelSnapshot.get(winnerId)
    const retainedResultingWinnerLevel =
      boundary.resultingCycleLevelSnapshot.get(winnerId)

    if (
      retainedPriorWinnerLevel === undefined ||
      retainedResultingWinnerLevel === undefined
    ) {
      throw new Error("Boundary transition snapshots lost the winning value")
    }

    const mutableUndoneSnapshot = undone.cycleLevelSnapshot as Map<
      ValueId,
      number
    >
    const mutableRedoneSnapshot = redone.cycleLevelSnapshot as Map<
      ValueId,
      number
    >
    mutableUndoneSnapshot.set(winnerId, retainedPriorWinnerLevel + 1)
    mutableRedoneSnapshot.set(winnerId, retainedResultingWinnerLevel + 1)
    expect(boundary.priorCycleLevelSnapshot.get(winnerId)).toBe(
      retainedPriorWinnerLevel,
    )
    expect(boundary.resultingCycleLevelSnapshot.get(winnerId)).toBe(
      retainedResultingWinnerLevel,
    )
    expect(
      projectScheduledPair(undone.activeDeck, undone.scheduler).pair,
    ).toEqual(candidate.delta.pair)
  })

  it("rejects stale Undo and Redo source schedulers without mutating either state", () => {
    const battleCycle = createInitialBattleCycle("stale-delta-source-seed")
    const [winnerId] = projectScheduledPair(
      battleCycle.activeDeck,
      battleCycle.scheduler,
    ).pair
    const candidate = createBattleCycleCandidate({
      battleCycle,
      winnerId,
      expectedScheduler: battleCycle.scheduler,
    })
    const priorProgressEntries = Array.from(battleCycle.progressById)
    const resultingProgressEntries = Array.from(candidate.progressById)

    expect(() =>
      undoBattleDelta({ battleCycle, delta: candidate.delta }),
    ).toThrow("Undo requires the Battle Delta resulting scheduler")
    expect(() =>
      redoBattleDelta({ battleCycle: candidate, delta: candidate.delta }),
    ).toThrow("Redo requires the Battle Delta prior scheduler")
    expect(Array.from(battleCycle.progressById)).toEqual(priorProgressEntries)
    expect(Array.from(candidate.progressById)).toEqual(resultingProgressEntries)
    expect(battleCycle.scheduler.cursor).toBe(0)
    expect(candidate.scheduler.cursor).toBe(1)
  })

  it("rejects tampered delta evidence and mismatched progress without mutation", () => {
    const battleCycle = createInitialBattleCycle("tampered-delta-evidence-seed")
    const [winnerId] = projectScheduledPair(
      battleCycle.activeDeck,
      battleCycle.scheduler,
    ).pair
    const candidate = createBattleCycleCandidate({
      battleCycle,
      winnerId,
      expectedScheduler: battleCycle.scheduler,
    })
    const tamperedPayoutDelta = Object.freeze({
      ...candidate.delta,
      xpGained: candidate.delta.xpGained + 1,
    }) satisfies BattleDelta
    const tamperedIdentityDelta = Object.freeze({
      ...candidate.delta,
      battleId:
        `${candidate.delta.battleId}:tampered` as BattleDelta["battleId"],
    }) satisfies BattleDelta
    const mismatchedWinnerProgress = {
      ...candidate.delta.resultingWinnerProgress,
      totalXp: candidate.delta.resultingWinnerProgress.totalXp + 1,
    }
    const mismatchedProgressById = replaceProgress(
      candidate,
      new Map([[winnerId, mismatchedWinnerProgress]]),
    )
    const mismatchedCandidate = Object.freeze({
      ...candidate,
      progressById: mismatchedProgressById,
    }) satisfies BattleCycleState
    const resultingProgressEntries = Array.from(candidate.progressById)
    const mismatchedProgressEntries = Array.from(
      mismatchedCandidate.progressById,
    )

    expect(() =>
      undoBattleDelta({
        battleCycle: candidate,
        delta: tamperedPayoutDelta,
      }),
    ).toThrow("Battle Delta progress transition is inconsistent")
    expect(() =>
      undoBattleDelta({
        battleCycle: candidate,
        delta: tamperedIdentityDelta,
      }),
    ).toThrow("Battle Delta identity does not match its profile boundary")
    expect(() =>
      undoBattleDelta({
        battleCycle: mismatchedCandidate,
        delta: candidate.delta,
      }),
    ).toThrow(`Undo progress does not match Battle Delta for ${winnerId}`)
    expect(Array.from(candidate.progressById)).toEqual(resultingProgressEntries)
    expect(Array.from(mismatchedCandidate.progressById)).toEqual(
      mismatchedProgressEntries,
    )
  })
})
