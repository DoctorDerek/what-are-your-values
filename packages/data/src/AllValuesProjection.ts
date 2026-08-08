import type { CustomValueDefinition } from "./Value"
import {
  sortRankedValuesAlphabetically,
  type RankedValue,
} from "./ValueRanking"
import { filterRankedValuesByQuery } from "./ValueSearch"

export type AllValuesProjection = Readonly<{
  hasComparisons: boolean
  orderedValues: readonly RankedValue[]
  visibleValues: readonly RankedValue[]
  existingCustomValues: readonly CustomValueDefinition[]
}>

export function projectAllValues({
  rankedValues,
  searchQuery,
}: {
  readonly rankedValues: readonly RankedValue[]
  readonly searchQuery: string
}) {
  const hasComparisons = rankedValues.some(
    ({ progress }) => progress.profileComparisons > 0,
  )
  const orderedValues = hasComparisons
    ? rankedValues
    : sortRankedValuesAlphabetically(rankedValues)

  return Object.freeze({
    hasComparisons,
    orderedValues,
    visibleValues: Object.freeze([
      ...filterRankedValuesByQuery(orderedValues, searchQuery),
    ]),
    existingCustomValues: Object.freeze(
      rankedValues.flatMap(({ definition }) =>
        definition.kind === "custom" ? [definition] : [],
      ),
    ),
  }) satisfies AllValuesProjection
}
