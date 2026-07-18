import { getPairCount } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import {
  createValueProgressById,
  type ValueProgress,
} from "@game/data/src/ValueProgress"
import { getLevelFromXP } from "@game/utils/src/LevelMath"
import { describe, expect, it } from "vitest"
import {
  createBattleCycleCandidate,
  createInitialBattleCycle,
  type BattleCycleState,
} from "./BattleCycle"
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

describe("Battle Cycle", () => {
  it("initializes the complete canonical Active Deck and one compact projection", () => {
    const battleCycle = createInitialBattleCycle("initial-cycle-seed")
    const projection = projectScheduledPair(
      battleCycle.activeDeck,
      battleCycle.scheduler,
    )

    expect(battleCycle.activeDeck.valueIds).toHaveLength(100)
    expect(
      battleCycle.activeDeck.valueIds.every((valueId) =>
        valueId.startsWith("pvcs-2011:"),
      ),
    ).toBe(true)
    expect(battleCycle.progressById.size).toBe(100)
    expect(battleCycle.cycleLevelSnapshot.size).toBe(100)
    expect(battleCycle.scheduler.cursor).toBe(0)
    expect(battleCycle.scheduler).not.toHaveProperty("pairs")
    expect(projection.pair).toHaveLength(2)
  })

  it("commits one first-cycle winner and rejects the stale command afterward", () => {
    const battleCycle = createInitialBattleCycle("single-battle-seed")
    const pair = projectScheduledPair(
      battleCycle.activeDeck,
      battleCycle.scheduler,
    ).pair
    const [winnerId, loserId] = pair
    const candidate = createBattleCycleCandidate({
      battleCycle,
      winnerId,
      expectedScheduler: battleCycle.scheduler,
    })

    expect(candidate.delta).toMatchObject({
      pair,
      winnerId,
      loserId,
      xpGained: 1,
    })
    expect(candidate.progressById.get(winnerId)).toEqual({
      totalXp: 1,
      profileWins: 1,
      profileComparisons: 1,
      currentCycleWins: 1,
    })
    expect(candidate.progressById.get(loserId)).toEqual({
      totalXp: 0,
      profileWins: 0,
      profileComparisons: 1,
      currentCycleWins: 0,
    })
    expect(candidate.scheduler.cursor).toBe(1)
    expect(candidate.cycleLevelSnapshot).toBe(battleCycle.cycleLevelSnapshot)
    expect(battleCycle.progressById.get(winnerId)?.totalXp).toBe(0)
    expect(() =>
      createBattleCycleCandidate({
        battleCycle: candidate,
        winnerId,
        expectedScheduler: battleCycle.scheduler,
      }),
    ).toThrow("does not match the current scheduler")
  })

  it("rolls the final battle atomically into a fresh cycle snapshot", () => {
    const initialBattleCycle = createInitialBattleCycle("rollover-seed")
    const finalScheduler = createSchedulerRestorePoint({
      activeDeck: initialBattleCycle.activeDeck,
      progressGeneration: 0,
      deckRevision: 0,
      seed: initialBattleCycle.scheduler.seed,
      cycleIndex: 0,
      cursor: getPairCount(initialBattleCycle.activeDeck.valueIds.length) - 1,
    })
    const [winnerId, loserId] = projectScheduledPair(
      initialBattleCycle.activeDeck,
      finalScheduler,
    ).pair
    const progressById = replaceProgress(
      initialBattleCycle,
      new Map([
        [winnerId, createProgress(3, 2, 3, 1)],
        [loserId, createProgress(210, 7, 12, 1)],
      ]),
    )
    const battleCycle = Object.freeze({
      ...initialBattleCycle,
      progressById,
      scheduler: finalScheduler,
    }) satisfies BattleCycleState
    const candidate = createBattleCycleCandidate({
      battleCycle,
      winnerId,
      expectedScheduler: finalScheduler,
    })

    expect(candidate.delta.xpGained).toBe(1)
    expect(candidate.delta.resultingWinnerProgress.currentCycleWins).toBe(2)
    expect(candidate.progressById.get(winnerId)).toEqual({
      totalXp: 4,
      profileWins: 3,
      profileComparisons: 4,
      currentCycleWins: 0,
    })
    expect(candidate.progressById.get(loserId)).toEqual({
      totalXp: 210,
      profileWins: 7,
      profileComparisons: 13,
      currentCycleWins: 0,
    })
    expect(
      Array.from(candidate.progressById.values()).every(
        ({ currentCycleWins }) => currentCycleWins === 0,
      ),
    ).toBe(true)
    expect(candidate.scheduler.cycleIndex).toBe(1)
    expect(candidate.scheduler.cursor).toBe(0)
    expect(candidate.cycleLevelSnapshot.get(winnerId)).toBe(getLevelFromXP(4))
    expect(candidate.cycleLevelSnapshot.get(loserId)).toBe(getLevelFromXP(210))
  })
})
