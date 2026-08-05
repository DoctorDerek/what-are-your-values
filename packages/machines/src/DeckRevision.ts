import { createActiveDeck, type ActiveDeck } from "@game/data/src/ActiveDeck"
import type { CustomValueDefinition, CustomValueId } from "@game/data/src/Value"
import {
  reconfigureValueProgress,
  type ValueProgressById,
} from "@game/data/src/ValueProgress"
import {
  createCyclePayoutTierSnapshot,
  type CyclePayoutTierSnapshot,
} from "./CyclePayoutTierSnapshot"
import {
  createDeckReconfigurationRestorePoint,
  type DeckReconfigurationRestorePoint,
} from "./DeckReconfigurationScheduler"
import {
  createSchedulerRestorePoint,
  type SchedulerRestorePoint,
} from "./PairScheduler"

export type DeckRevisionCandidate = {
  readonly activeDeck: ActiveDeck
  readonly progressById: ValueProgressById
  readonly cyclePayoutTierSnapshot: CyclePayoutTierSnapshot
  readonly scheduler: SchedulerRestorePoint | DeckReconfigurationRestorePoint
  readonly joinedValueIds: readonly CustomValueId[]
  readonly deckRevision: number
  readonly progressGeneration: number
}

function validateGeneration(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

function incrementDeckRevision(deckRevision: number) {
  validateGeneration(deckRevision, "deck revision")

  if (deckRevision === Number.MAX_SAFE_INTEGER) {
    throw new Error("Deck revision cannot be incremented safely")
  }

  return deckRevision + 1
}

function validateRetainedCustomValueIdentity(
  priorActiveDeck: ActiveDeck,
  revisedCustomValues: readonly CustomValueDefinition[],
) {
  const priorCustomValuesById = new Map(
    priorActiveDeck.customValues.map((value) => [value.id, value]),
  )

  for (const revisedValue of revisedCustomValues) {
    const priorValue = priorCustomValuesById.get(revisedValue.id)
    if (!priorValue) {
      continue
    }

    if (revisedValue.creationOrdinal !== priorValue.creationOrdinal) {
      throw new Error(
        `Custom Value creation ordinal is immutable: ${revisedValue.id}`,
      )
    }

    if (revisedValue.createdAt !== priorValue.createdAt) {
      throw new Error(
        `Custom Value creation timestamp is immutable: ${revisedValue.id}`,
      )
    }
  }
}

export function createDeckRevisionCandidate({
  priorActiveDeck,
  revisedCustomValues,
  progressById,
  deckRevision,
  progressGeneration,
  seed,
}: {
  readonly priorActiveDeck: ActiveDeck
  readonly revisedCustomValues: readonly CustomValueDefinition[]
  readonly progressById: ValueProgressById
  readonly deckRevision: number
  readonly progressGeneration: number
  readonly seed: string
}) {
  validateGeneration(progressGeneration, "progress generation")
  validateRetainedCustomValueIdentity(priorActiveDeck, revisedCustomValues)

  const activeDeck = createActiveDeck(revisedCustomValues)
  if (activeDeck.fingerprint === priorActiveDeck.fingerprint) {
    throw new Error("Deck revision does not change Active Deck meaning")
  }

  const nextDeckRevision = incrementDeckRevision(deckRevision)
  const revisedProgressById = reconfigureValueProgress({
    priorActiveDeck,
    revisedActiveDeck: activeDeck,
    progressById,
  })
  const priorValueIdSet = new Set(priorActiveDeck.valueIds)
  const joinedValueIds = Object.freeze(
    activeDeck.customValues
      .filter(({ id }) => !priorValueIdSet.has(id))
      .map(({ id }) => id),
  )
  const scheduler =
    joinedValueIds.length > 0
      ? createDeckReconfigurationRestorePoint({
          activeDeck,
          joinedValueIds,
          progressGeneration,
          deckRevision: nextDeckRevision,
          seed,
          cycleIndex: 0,
        })
      : createSchedulerRestorePoint({
          activeDeck,
          progressGeneration,
          deckRevision: nextDeckRevision,
          seed,
          cycleIndex: 0,
        })

  return Object.freeze({
    activeDeck,
    progressById: revisedProgressById,
    cyclePayoutTierSnapshot: createCyclePayoutTierSnapshot(
      activeDeck,
      revisedProgressById,
    ),
    scheduler,
    joinedValueIds,
    deckRevision: nextDeckRevision,
    progressGeneration,
  }) satisfies DeckRevisionCandidate
}
