import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import {
  readActiveValueId,
  readNonNegativeSafeInteger,
  readTuple,
} from "./PersistenceValidation"

export type EncodedValueNumberEntry = readonly [valueId: string, value: number]

export function encodeValueNumberEntries(
  entries: ReadonlyMap<ValueId, number>,
): readonly EncodedValueNumberEntry[] {
  return Array.from(entries, ([valueId, value]) => [valueId, value] as const)
}

export function decodeCompleteValueNumberMap(
  activeDeck: ActiveDeck,
  value: unknown,
  label: string,
  minimumValue: number,
) {
  if (!Array.isArray(value) || value.length !== activeDeck.valueIds.length) {
    throw new Error(`${label} does not cover the complete Active Deck`)
  }

  const decoded = new Map<ValueId, number>()
  value.forEach((entry, index) => {
    const tuple = readTuple(entry, 2, `${label} entry ${index}`)
    const valueId = readActiveValueId(activeDeck, tuple[0], `${label} Value ID`)
    const number = readNonNegativeSafeInteger(
      tuple[1],
      `${label} value for ${valueId}`,
    )
    if (number < minimumValue) {
      throw new Error(`Invalid ${label} value for ${valueId}: ${number}`)
    }
    if (decoded.has(valueId)) {
      throw new Error(`${label} contains duplicate Value ID: ${valueId}`)
    }

    decoded.set(valueId, number)
  })

  return new Map(
    activeDeck.valueIds.map((valueId) => {
      const number = decoded.get(valueId)
      if (number === undefined) {
        throw new Error(`${label} is missing ${valueId}`)
      }

      return [valueId, number] as const
    }),
  )
}
