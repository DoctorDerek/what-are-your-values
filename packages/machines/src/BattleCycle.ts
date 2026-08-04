import { createActiveDeck, type ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import {
  beginNextValueProgressCycle,
  createInitialValueProgress,
  type ValueProgressById,
} from "@game/data/src/ValueProgress"
import {
  createBattleDelta,
  createCycleBoundaryTransition,
  type BattleDelta,
} from "./BattleDelta"
import { createBattleId } from "./BattleIdentity"
import { createBattleProgressCandidate } from "./BattleProgress"
import {
  advanceBattleScheduler,
  createNextCycleScheduler,
  projectBattlePair,
  type BattleSchedulerRestorePoint,
} from "./BattleScheduler"
import {
  createCyclePayoutTierSnapshot,
  type CyclePayoutTierSnapshot,
} from "./CyclePayoutTierSnapshot"
import { createSchedulerRestorePoint } from "./PairScheduler"
import { areSchedulerIdentitiesEqual } from "./SchedulerIdentity"

export type BattleCycleState = {
  readonly activeDeck: ActiveDeck
  readonly progressById: ValueProgressById
  readonly cyclePayoutTierSnapshot: CyclePayoutTierSnapshot
  readonly scheduler: BattleSchedulerRestorePoint
}

export type BattleCycleCandidate = BattleCycleState & {
  readonly delta: BattleDelta
}

export function createInitialBattleCycle(seed: string) {
  const activeDeck = createActiveDeck([])
  const progressById = createInitialValueProgress(activeDeck)

  return Object.freeze({
    activeDeck,
    progressById,
    cyclePayoutTierSnapshot: createCyclePayoutTierSnapshot(
      activeDeck,
      progressById,
    ),
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
  readonly expectedScheduler: BattleSchedulerRestorePoint
}) {
  if (!areSchedulerIdentitiesEqual(battleCycle.scheduler, expectedScheduler)) {
    throw new Error("Battle command does not match the current scheduler")
  }

  const pair = projectBattlePair(battleCycle.activeDeck, battleCycle.scheduler)
  const progressCandidate = createBattleProgressCandidate({
    activeDeck: battleCycle.activeDeck,
    progressById: battleCycle.progressById,
    cyclePayoutTierSnapshot: battleCycle.cyclePayoutTierSnapshot,
    pair,
    winnerId,
  })
  const advancedScheduler = advanceBattleScheduler(
    battleCycle.activeDeck,
    battleCycle.scheduler,
  )

  if (advancedScheduler) {
    return Object.freeze({
      activeDeck: battleCycle.activeDeck,
      progressById: progressCandidate.progressById,
      cyclePayoutTierSnapshot: battleCycle.cyclePayoutTierSnapshot,
      scheduler: advancedScheduler,
      delta: createBattleDelta({
        activeDeck: battleCycle.activeDeck,
        progressDelta: progressCandidate.delta,
        priorScheduler: battleCycle.scheduler,
        resultingScheduler: advancedScheduler,
        cycleBoundary: null,
      }),
    }) satisfies BattleCycleCandidate
  }

  const nextCycleProgressById = beginNextValueProgressCycle(
    battleCycle.activeDeck,
    progressCandidate.progressById,
  )

  const resultingCyclePayoutTierSnapshot = createCyclePayoutTierSnapshot(
    battleCycle.activeDeck,
    nextCycleProgressById,
  )
  const resultingScheduler = createNextCycleScheduler(
    battleCycle.activeDeck,
    battleCycle.scheduler,
  )
  const battleId = createBattleId(battleCycle.scheduler)

  return Object.freeze({
    activeDeck: battleCycle.activeDeck,
    progressById: nextCycleProgressById,
    cyclePayoutTierSnapshot: resultingCyclePayoutTierSnapshot,
    scheduler: resultingScheduler,
    delta: createBattleDelta({
      activeDeck: battleCycle.activeDeck,
      progressDelta: progressCandidate.delta,
      priorScheduler: battleCycle.scheduler,
      resultingScheduler,
      cycleBoundary: createCycleBoundaryTransition({
        activeDeck: battleCycle.activeDeck,
        battleId,
        priorCyclePayoutTierSnapshot: battleCycle.cyclePayoutTierSnapshot,
        resultingCyclePayoutTierSnapshot,
        priorProgressById: battleCycle.progressById,
        resultingProgressById: nextCycleProgressById,
      }),
    }),
  }) satisfies BattleCycleCandidate
}
