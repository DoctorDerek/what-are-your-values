import {
  getValueDisplayDefinition,
  getValueDisplayName,
  normalizeValueNameForComparison,
  type ValueId,
} from "./Value"
import type { RankedValue } from "./ValueRanking"

export function filterRankedValuesByQuery(
  rankedValues: readonly RankedValue[],
  query: string,
) {
  const normalizedQuery = normalizeValueNameForComparison(query)
  if (normalizedQuery.length === 0) {
    return rankedValues
  }

  return rankedValues.filter(
    ({ definition }) =>
      normalizeValueNameForComparison(getValueDisplayName(definition)).includes(
        normalizedQuery,
      ) ||
      getValueDisplayDefinition(definition)
        .toLocaleLowerCase("en-US")
        .includes(normalizedQuery),
  )
}

export function findRankedValueNameMatches(
  rankedValues: readonly RankedValue[],
  name: string,
) {
  const normalizedName = normalizeValueNameForComparison(name)
  if (normalizedName.length === 0) {
    return Object.freeze([])
  }

  return Object.freeze(
    rankedValues.filter(({ definition }) =>
      normalizeValueNameForComparison(getValueDisplayName(definition)).includes(
        normalizedName,
      ),
    ),
  )
}

export function hasExactRankedValueNameCollision({
  rankedValues,
  name,
  excludedValueId,
}: {
  readonly rankedValues: readonly RankedValue[]
  readonly name: string
  readonly excludedValueId?: ValueId | null
}) {
  const normalizedName = normalizeValueNameForComparison(name)
  return (
    normalizedName.length > 0 &&
    rankedValues.some(
      ({ definition }) =>
        definition.id !== excludedValueId &&
        normalizeValueNameForComparison(getValueDisplayName(definition)) ===
          normalizedName,
    )
  )
}
