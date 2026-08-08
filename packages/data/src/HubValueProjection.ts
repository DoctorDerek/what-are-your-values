import {
  sortRankedValuesAlphabetically,
  type RankedValue,
} from "./ValueRanking"

export type HubValueProjection = {
  readonly hasComparisons: boolean
  readonly visibleValues: readonly RankedValue[]
  readonly topFive: readonly RankedValue[]
  readonly remainingValues: readonly RankedValue[]
}

export function projectHubValues(rankedValues: readonly RankedValue[]) {
  const hasComparisons = rankedValues.some(
    ({ progress }) => progress.profileComparisons > 0,
  )
  const visibleValues = hasComparisons
    ? Object.freeze([...rankedValues])
    : sortRankedValuesAlphabetically(rankedValues)

  return Object.freeze({
    hasComparisons,
    visibleValues,
    topFive: Object.freeze(visibleValues.slice(0, 5)),
    remainingValues: Object.freeze(visibleValues.slice(5)),
  }) satisfies HubValueProjection
}
