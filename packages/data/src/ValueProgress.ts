import { MAX_SUPPORTED_TOTAL_XP } from "@game/utils/src/LevelMath"
import type { ActiveDeck } from "./ActiveDeck"
import type { ValueId } from "./Value"

export type ValueProgress = {
  readonly totalXp: number
  readonly profileWins: number
  readonly profileComparisons: number
  readonly currentCycleWins: number
}

export type ValueProgressEntry = readonly [
  valueId: ValueId,
  progress: ValueProgress,
]

export type ValueProgressById = ReadonlyMap<ValueId, ValueProgress>

function validateCounter(
  value: number,
  label: string,
  valueId: ValueId,
  maximum: number = Number.MAX_SAFE_INTEGER,
) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`Invalid ${label} for ${valueId}: ${value}`)
  }
}

function freezeValueProgress(valueId: ValueId, progress: ValueProgress) {
  validateCounter(progress.totalXp, "total XP", valueId, MAX_SUPPORTED_TOTAL_XP)
  validateCounter(progress.profileWins, "profile wins", valueId)
  validateCounter(progress.profileComparisons, "profile comparisons", valueId)
  validateCounter(progress.currentCycleWins, "current-cycle wins", valueId)

  if (progress.profileWins > progress.profileComparisons) {
    throw new Error(`Profile wins exceed comparisons for ${valueId}`)
  }

  if (progress.currentCycleWins > progress.profileWins) {
    throw new Error(`Current-cycle wins exceed profile wins for ${valueId}`)
  }

  if (progress.totalXp < progress.profileWins) {
    throw new Error(`Total XP is lower than profile wins for ${valueId}`)
  }

  return Object.freeze({ ...progress })
}

function createUnplayedValueProgress() {
  return Object.freeze({
    totalXp: 0,
    profileWins: 0,
    profileComparisons: 0,
    currentCycleWins: 0,
  }) satisfies ValueProgress
}

export function createValueProgressById(
  activeDeck: ActiveDeck,
  candidateEntries: readonly ValueProgressEntry[],
) {
  const candidateProgressById = new Map<ValueId, ValueProgress>()

  candidateEntries.forEach(([valueId, progress]) => {
    if (candidateProgressById.has(valueId)) {
      throw new Error(`Duplicate Value Progress ID: ${valueId}`)
    }

    candidateProgressById.set(valueId, freezeValueProgress(valueId, progress))
  })

  if (candidateProgressById.size !== activeDeck.valueIds.length) {
    throw new Error("Value Progress does not cover the complete Active Deck")
  }

  const activeValueIdSet = new Set(activeDeck.valueIds)
  candidateProgressById.forEach((_progress, valueId) => {
    if (!activeValueIdSet.has(valueId)) {
      throw new Error(`Value Progress contains an inactive ID: ${valueId}`)
    }
  })

  return new Map(
    activeDeck.valueIds.map((valueId) => {
      const progress = candidateProgressById.get(valueId)

      if (!progress) {
        throw new Error(`Value Progress is missing an active ID: ${valueId}`)
      }

      return [valueId, progress]
    }),
  ) satisfies ValueProgressById
}

export function createInitialValueProgress(activeDeck: ActiveDeck) {
  return createValueProgressById(
    activeDeck,
    activeDeck.valueIds.map((valueId) => [
      valueId,
      createUnplayedValueProgress(),
    ]),
  )
}

export function reconfigureValueProgress({
  priorActiveDeck,
  revisedActiveDeck,
  progressById,
}: {
  readonly priorActiveDeck: ActiveDeck
  readonly revisedActiveDeck: ActiveDeck
  readonly progressById: ValueProgressById
}) {
  const validatedProgressById = createValueProgressById(
    priorActiveDeck,
    Array.from(progressById),
  )

  return createValueProgressById(
    revisedActiveDeck,
    revisedActiveDeck.valueIds.map((valueId) => {
      const retainedProgress = validatedProgressById.get(valueId)

      return [
        valueId,
        retainedProgress
          ? { ...retainedProgress, currentCycleWins: 0 }
          : createUnplayedValueProgress(),
      ]
    }),
  )
}

export function beginNextValueProgressCycle(
  activeDeck: ActiveDeck,
  progressById: ValueProgressById,
) {
  const validatedProgressById = createValueProgressById(
    activeDeck,
    Array.from(progressById),
  )

  return createValueProgressById(
    activeDeck,
    activeDeck.valueIds.map((valueId) => {
      const progress = validatedProgressById.get(valueId)

      if (!progress) {
        throw new Error(`Value Progress is missing ${valueId}`)
      }

      return [valueId, { ...progress, currentCycleWins: 0 }]
    }),
  )
}

export function resetValueProgress(activeDeck: ActiveDeck) {
  return createInitialValueProgress(activeDeck)
}
