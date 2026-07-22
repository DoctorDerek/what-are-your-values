import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import {
  createValueProgress,
  createValueProgressById,
  type ValueProgress,
  type ValueProgressById,
} from "@game/data/src/ValueProgress"
import {
  readActiveValueId,
  readNonNegativeSafeInteger,
  readTuple,
} from "./PersistenceValidation"

export type EncodedValueProgress = readonly [
  totalXp: number,
  profileWins: number,
  profileComparisons: number,
  currentCycleWins: number,
]

export type EncodedValueProgressEntry = readonly [
  valueId: string,
  totalXp: number,
  profileWins: number,
  profileComparisons: number,
  currentCycleWins: number,
]

export function encodeValueProgress(
  progress: ValueProgress,
): EncodedValueProgress {
  return [
    progress.totalXp,
    progress.profileWins,
    progress.profileComparisons,
    progress.currentCycleWins,
  ]
}

export function decodeValueProgress(
  valueId: ValueId,
  value: unknown,
  label: string,
) {
  const tuple = readTuple(value, 4, label)

  return createValueProgress(valueId, {
    totalXp: readNonNegativeSafeInteger(tuple[0], `${label} total XP`),
    profileWins: readNonNegativeSafeInteger(tuple[1], `${label} profile wins`),
    profileComparisons: readNonNegativeSafeInteger(
      tuple[2],
      `${label} profile comparisons`,
    ),
    currentCycleWins: readNonNegativeSafeInteger(
      tuple[3],
      `${label} current-cycle wins`,
    ),
  })
}

export function encodeValueProgressEntries(
  progressById: ValueProgressById,
): readonly EncodedValueProgressEntry[] {
  return Array.from(progressById, ([valueId, progress]) => [
    valueId,
    ...encodeValueProgress(progress),
  ])
}

export function decodeValueProgressById(
  activeDeck: ActiveDeck,
  value: unknown,
) {
  if (!Array.isArray(value) || value.length !== activeDeck.valueIds.length) {
    throw new Error("Value Progress does not cover the complete Active Deck")
  }

  const progressById = createValueProgressById(
    activeDeck,
    value.map((entry, index) => {
      const label = `Value Progress entry ${index}`
      const tuple = readTuple(entry, 5, label)
      const valueId = readActiveValueId(
        activeDeck,
        tuple[0],
        `${label} Value ID`,
      )

      return [valueId, decodeValueProgress(valueId, tuple.slice(1), label)]
    }),
  )

  if (
    JSON.stringify(encodeValueProgressEntries(progressById)) !==
    JSON.stringify(value)
  ) {
    throw new Error("Value Progress encoding is not canonical")
  }

  return progressById
}
