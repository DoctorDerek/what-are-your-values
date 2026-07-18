import { createActiveDeck, type ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import {
  beginNextValueProgressCycle,
  createInitialValueProgress,
  type ValueProgressById,
} from "@game/data/src/ValueProgress"
import {
  createBattleProgressCandidate,
  type BattleProgressDelta,
} from "./BattleProgress"
import {
  createCycleLevelSnapshot,
  type CycleLevelSnapshot,
} from "./CycleLevelSnapshot"
import {
  advanceSchedulerCursor,
  createSchedulerRestorePoint,
  projectScheduledPair,
  type SchedulerRestorePoint,
} from "./PairScheduler"
import { areSchedulerIdentitiesEqual } from "./SchedulerIdentity"

export type BattleCycleState = {
  readonly activeDeck: ActiveDeck
  readonly progressById: ValueProgressById
  readonly cycleLevelSnapshot: CycleLevelSnapshot
  readonly scheduler: SchedulerRestorePoint
}

export type BattleCycleCandidate = BattleCycleState & {
  readonly delta: BattleProgressDelta
}

export function createInitialBattleCycle(seed: string) {
  const activeDeck = createActiveDeck([])
  const progressById = createInitialValueProgress(activeDeck)

  return Object.freeze({
    activeDeck,
    progressById,
    cycleLevelSnapshot: createCycleLevelSnapshot(activeDeck, progressById),
    scheduler: createSchedulerRestorePoint({
      activeDeck,
      progressGeneration: 0,
      deckRevision: 0,
      seed,
      cycleIndex: 0,
    }),
  }) satisfies BattleCycleState
}

export function createBattleCycleCandidate({
  battleCycle,
  winnerId,
  expectedScheduler,
}: {
  readonly battleCycle: BattleCycleState
  readonly winnerId: ValueId
  readonly expectedScheduler: SchedulerRestorePoint
}) {
  if (!areSchedulerIdentitiesEqual(battleCycle.scheduler, expectedScheduler)) {
    throw new Error("Battle command does not match the current scheduler")
  }

  const pair = projectScheduledPair(
    battleCycle.activeDeck,
    battleCycle.scheduler,
  ).pair
  const progressCandidate = createBattleProgressCandidate({
    activeDeck: battleCycle.activeDeck,
    progressById: battleCycle.progressById,
    cycleLevelSnapshot: battleCycle.cycleLevelSnapshot,
    pair,
    winnerId,
  })
  const advancedScheduler = advanceSchedulerCursor(
    battleCycle.activeDeck,
    battleCycle.scheduler,
  )

  if (advancedScheduler) {
    return Object.freeze({
      activeDeck: battleCycle.activeDeck,
      progressById: progressCandidate.progressById,
      cycleLevelSnapshot: battleCycle.cycleLevelSnapshot,
      scheduler: advancedScheduler,
      delta: progressCandidate.delta,
    }) satisfies BattleCycleCandidate
  }

  if (battleCycle.scheduler.cycleIndex === Number.MAX_SAFE_INTEGER) {
    throw new Error("Pair cycle index cannot be incremented safely")
  }

  const nextCycleProgressById = beginNextValueProgressCycle(
    battleCycle.activeDeck,
    progressCandidate.progressById,
  )

  return Object.freeze({
    activeDeck: battleCycle.activeDeck,
    progressById: nextCycleProgressById,
    cycleLevelSnapshot: createCycleLevelSnapshot(
      battleCycle.activeDeck,
      nextCycleProgressById,
    ),
    scheduler: createSchedulerRestorePoint({
      activeDeck: battleCycle.activeDeck,
      progressGeneration: battleCycle.scheduler.progressGeneration,
      deckRevision: battleCycle.scheduler.deckRevision,
      seed: battleCycle.scheduler.seed,
      cycleIndex: battleCycle.scheduler.cycleIndex + 1,
    }),
    delta: progressCandidate.delta,
  }) satisfies BattleCycleCandidate
}
