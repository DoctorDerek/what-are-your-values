import type {
  ActiveDeck,
  ActiveDeckFingerprint,
} from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import type { ValueProgressById } from "@game/data/src/ValueProgress"
import {
  createBattleId,
  createCycleCompleteEventId,
  type BattleId,
  type CycleCompleteEventId,
} from "./BattleIdentity"
import type { BattleProgressDelta } from "./BattleProgress"
import {
  advanceBattleScheduler,
  createNextCycleScheduler,
  projectBattlePair,
  type BattleSchedulerRestorePoint,
} from "./BattleScheduler"
import {
  validateCyclePayoutTierSnapshot,
  type CyclePayoutTierSnapshot,
} from "./CyclePayoutTierSnapshot"
import { areSchedulerIdentitiesEqual } from "./SchedulerIdentity"

export const BATTLE_DELTA_VERSION = 1 as const
export const CYCLE_BOUNDARY_TRANSITION_VERSION = 1 as const

export type CurrentCycleWinsById = ReadonlyMap<ValueId, number>

export type CycleBoundaryTransition = {
  readonly version: typeof CYCLE_BOUNDARY_TRANSITION_VERSION
  readonly cycleCompleteEventId: CycleCompleteEventId
  readonly priorCyclePayoutTierSnapshot: CyclePayoutTierSnapshot
  readonly resultingCyclePayoutTierSnapshot: CyclePayoutTierSnapshot
  readonly priorCurrentCycleWinsById: CurrentCycleWinsById
  readonly resultingCurrentCycleWinsById: CurrentCycleWinsById
}

export type BattleDelta = BattleProgressDelta & {
  readonly version: typeof BATTLE_DELTA_VERSION
  readonly battleId: BattleId
  readonly progressGeneration: number
  readonly deckRevision: number
  readonly activeDeckFingerprint: ActiveDeckFingerprint
  readonly cycleIndex: number
  readonly priorScheduler: BattleSchedulerRestorePoint
  readonly resultingScheduler: BattleSchedulerRestorePoint
  readonly cycleBoundary: CycleBoundaryTransition | null
}

function createCurrentCycleWinsById(
  activeDeck: ActiveDeck,
  progressById: ValueProgressById,
) {
  return new Map(
    activeDeck.valueIds.map((valueId) => {
      const progress = progressById.get(valueId)

      if (!progress) {
        throw new Error(`Value Progress is missing ${valueId}`)
      }

      return [valueId, progress.currentCycleWins] as const
    }),
  ) satisfies CurrentCycleWinsById
}

export function createCycleBoundaryTransition({
  activeDeck,
  battleId,
  priorCyclePayoutTierSnapshot,
  resultingCyclePayoutTierSnapshot,
  priorProgressById,
  resultingProgressById,
}: {
  readonly activeDeck: ActiveDeck
  readonly battleId: BattleId
  readonly priorCyclePayoutTierSnapshot: CyclePayoutTierSnapshot
  readonly resultingCyclePayoutTierSnapshot: CyclePayoutTierSnapshot
  readonly priorProgressById: ValueProgressById
  readonly resultingProgressById: ValueProgressById
}) {
  return Object.freeze({
    version: CYCLE_BOUNDARY_TRANSITION_VERSION,
    cycleCompleteEventId: createCycleCompleteEventId(battleId),
    priorCyclePayoutTierSnapshot: validateCyclePayoutTierSnapshot(
      activeDeck,
      priorCyclePayoutTierSnapshot,
    ),
    resultingCyclePayoutTierSnapshot: validateCyclePayoutTierSnapshot(
      activeDeck,
      resultingCyclePayoutTierSnapshot,
    ),
    priorCurrentCycleWinsById: createCurrentCycleWinsById(
      activeDeck,
      priorProgressById,
    ),
    resultingCurrentCycleWinsById: createCurrentCycleWinsById(
      activeDeck,
      resultingProgressById,
    ),
  }) satisfies CycleBoundaryTransition
}

export function createBattleDelta({
  activeDeck,
  progressDelta,
  priorScheduler,
  resultingScheduler,
  cycleBoundary,
}: {
  readonly activeDeck: ActiveDeck
  readonly progressDelta: BattleProgressDelta
  readonly priorScheduler: BattleSchedulerRestorePoint
  readonly resultingScheduler: BattleSchedulerRestorePoint
  readonly cycleBoundary: CycleBoundaryTransition | null
}) {
  const projectedPair = projectBattlePair(activeDeck, priorScheduler)
  if (
    projectedPair[0] !== progressDelta.pair[0] ||
    projectedPair[1] !== progressDelta.pair[1]
  ) {
    throw new Error("Battle delta pair does not match its prior scheduler")
  }

  const scheduleKindTransitionIsCompatible =
    priorScheduler.scheduleKind === resultingScheduler.scheduleKind ||
    (cycleBoundary &&
      priorScheduler.scheduleKind === "join-pass" &&
      resultingScheduler.scheduleKind === "full-cycle")
  if (
    priorScheduler.activeDeckFingerprint !==
      resultingScheduler.activeDeckFingerprint ||
    priorScheduler.progressGeneration !==
      resultingScheduler.progressGeneration ||
    priorScheduler.deckRevision !== resultingScheduler.deckRevision ||
    !scheduleKindTransitionIsCompatible
  ) {
    throw new Error("Battle delta crosses an incompatible profile identity")
  }

  const ordinaryResultingScheduler = advanceBattleScheduler(
    activeDeck,
    priorScheduler,
  )
  if (ordinaryResultingScheduler) {
    if (
      cycleBoundary ||
      !areSchedulerIdentitiesEqual(
        ordinaryResultingScheduler,
        resultingScheduler,
      )
    ) {
      throw new Error("Battle delta scheduler transition is inconsistent")
    }
  } else {
    if (!cycleBoundary) {
      throw new Error("Battle delta scheduler transition is inconsistent")
    }

    const expectedResultingScheduler = createNextCycleScheduler(
      activeDeck,
      priorScheduler,
    )
    if (
      !areSchedulerIdentitiesEqual(
        expectedResultingScheduler,
        resultingScheduler,
      )
    ) {
      throw new Error("Battle delta scheduler transition is inconsistent")
    }
  }

  const battleId = createBattleId(priorScheduler)
  if (
    cycleBoundary &&
    cycleBoundary.cycleCompleteEventId !== createCycleCompleteEventId(battleId)
  ) {
    throw new Error("Cycle-complete event identity is inconsistent")
  }

  return Object.freeze({
    ...progressDelta,
    version: BATTLE_DELTA_VERSION,
    battleId,
    progressGeneration: priorScheduler.progressGeneration,
    deckRevision: priorScheduler.deckRevision,
    activeDeckFingerprint: priorScheduler.activeDeckFingerprint,
    cycleIndex: priorScheduler.cycleIndex,
    priorScheduler,
    resultingScheduler,
    cycleBoundary,
  }) satisfies BattleDelta
}
