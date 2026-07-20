import type { ActiveDeck } from "./ActiveDeck"
import type { ActiveValueDefinition } from "./Value"
import {
  createValueProgressById,
  type ValueProgress,
  type ValueProgressById,
} from "./ValueProgress"

export type RankedValue = {
  readonly rank: number
  readonly definition: ActiveValueDefinition
  readonly progress: ValueProgress
}

function compareStableValueOrder(
  first: ActiveValueDefinition,
  second: ActiveValueDefinition,
) {
  const firstKindRank = first.kind === "canonical" ? 0 : 1
  const secondKindRank = second.kind === "canonical" ? 0 : 1

  if (firstKindRank !== secondKindRank) {
    return firstKindRank - secondKindRank
  }

  const firstOrdinal =
    first.kind === "canonical" ? first.sourceOrdinal : first.creationOrdinal
  const secondOrdinal =
    second.kind === "canonical" ? second.sourceOrdinal : second.creationOrdinal

  if (firstOrdinal !== secondOrdinal) {
    return firstOrdinal - secondOrdinal
  }

  return first.id < second.id ? -1 : first.id > second.id ? 1 : 0
}

function compareRankedEvidence(
  first: Omit<RankedValue, "rank">,
  second: Omit<RankedValue, "rank">,
) {
  if (first.progress.totalXp !== second.progress.totalXp) {
    return second.progress.totalXp - first.progress.totalXp
  }

  if (first.progress.currentCycleWins !== second.progress.currentCycleWins) {
    return second.progress.currentCycleWins - first.progress.currentCycleWins
  }

  if (first.progress.profileWins !== second.progress.profileWins) {
    return second.progress.profileWins - first.progress.profileWins
  }

  return compareStableValueOrder(first.definition, second.definition)
}

export function rankValues(
  activeDeck: ActiveDeck,
  progressById: ValueProgressById,
) {
  const validatedProgressById = createValueProgressById(
    activeDeck,
    Array.from(progressById),
  )
  const rankedEvidence = activeDeck.values
    .map((definition) => {
      const progress = validatedProgressById.get(definition.id)

      if (!progress) {
        throw new Error(`Value Progress is missing ${definition.id}`)
      }

      return Object.freeze({ definition, progress })
    })
    .sort(compareRankedEvidence)

  return Object.freeze(
    rankedEvidence.map((value, index) =>
      Object.freeze({ rank: index + 1, ...value }),
    ),
  ) satisfies readonly RankedValue[]
}
