import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createValueProgressById,
  resetValueProgress,
  type ValueProgressById,
} from "@game/data/src/ValueProgress"
import {
  createCyclePayoutTierSnapshot,
  type CyclePayoutTierSnapshot,
} from "./CyclePayoutTierSnapshot"
import {
  createSchedulerRestorePoint,
  type SchedulerRestorePoint,
} from "./PairScheduler"

export type ProgressResetCandidate = {
  readonly activeDeck: ActiveDeck
  readonly progressById: ValueProgressById
  readonly cyclePayoutTierSnapshot: CyclePayoutTierSnapshot
  readonly scheduler: SchedulerRestorePoint
  readonly deckRevision: number
  readonly progressGeneration: number
}

function validateGeneration(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

export function createProgressResetCandidate({
  activeDeck,
  progressById,
  deckRevision,
  progressGeneration,
  seed,
}: {
  readonly activeDeck: ActiveDeck
  readonly progressById: ValueProgressById
  readonly deckRevision: number
  readonly progressGeneration: number
  readonly seed: string
}) {
  validateGeneration(deckRevision, "deck revision")
  validateGeneration(progressGeneration, "progress generation")
  createValueProgressById(activeDeck, Array.from(progressById))

  if (progressGeneration === Number.MAX_SAFE_INTEGER) {
    throw new Error("Progress generation cannot be incremented safely")
  }

  const nextProgressGeneration = progressGeneration + 1
  const resetProgressById = resetValueProgress(activeDeck)
  const cyclePayoutTierSnapshot = createCyclePayoutTierSnapshot(
    activeDeck,
    resetProgressById,
  )
  const scheduler = createSchedulerRestorePoint({
    activeDeck,
    progressGeneration: nextProgressGeneration,
    deckRevision,
    seed,
    cycleIndex: 0,
  })

  return Object.freeze({
    activeDeck,
    progressById: resetProgressById,
    cyclePayoutTierSnapshot,
    scheduler,
    deckRevision,
    progressGeneration: nextProgressGeneration,
  }) satisfies ProgressResetCandidate
}
