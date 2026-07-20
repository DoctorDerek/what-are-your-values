import { CANONICAL_VALUES } from "./CanonicalValues"
import {
  CANONICAL_CATALOG_VERSION,
  isCustomValueId,
  type ActiveValueDefinition,
  type CustomValueDefinition,
  type ValueId,
} from "./Value"

declare const activeDeckFingerprintBrand: unique symbol

export type ActiveDeckFingerprint = string & {
  readonly [activeDeckFingerprintBrand]: "active-deck"
}

export type ActiveDeck = {
  readonly catalogVersion: typeof CANONICAL_CATALOG_VERSION
  readonly customValues: readonly CustomValueDefinition[]
  readonly values: readonly ActiveValueDefinition[]
  readonly valueIds: readonly ValueId[]
  readonly fingerprint: ActiveDeckFingerprint
}

function compareCustomValues(
  first: CustomValueDefinition,
  second: CustomValueDefinition,
) {
  if (first.creationOrdinal !== second.creationOrdinal) {
    return first.creationOrdinal - second.creationOrdinal
  }

  return first.id < second.id ? -1 : first.id > second.id ? 1 : 0
}

function freezeCustomValue(value: CustomValueDefinition) {
  return Object.freeze({ ...value })
}

function validateCustomValue(value: CustomValueDefinition) {
  if (value.kind !== "custom" || !isCustomValueId(value.id)) {
    throw new Error(`Invalid Custom Value identity: ${value.id}`)
  }

  if (
    !Number.isSafeInteger(value.creationOrdinal) ||
    value.creationOrdinal < 1
  ) {
    throw new Error(`Invalid Custom Value creation ordinal: ${value.id}`)
  }

  if (value.name.trim().length === 0) {
    throw new Error(`Custom Value name is required: ${value.id}`)
  }

  if (value.definition.trim().length === 0) {
    throw new Error(`Custom Value definition is required: ${value.id}`)
  }
}

function createActiveDeckFingerprint(
  customValues: readonly CustomValueDefinition[],
) {
  return JSON.stringify([
    CANONICAL_CATALOG_VERSION,
    customValues.map(({ id, creationOrdinal, name, definition }) => [
      id,
      creationOrdinal,
      name,
      definition,
    ]),
  ]) as ActiveDeckFingerprint
}

export function createActiveDeck(
  candidateCustomValues: readonly CustomValueDefinition[],
) {
  candidateCustomValues.forEach(validateCustomValue)

  const customValueIds = new Set(candidateCustomValues.map(({ id }) => id))
  if (customValueIds.size !== candidateCustomValues.length) {
    throw new Error("Active Deck contains duplicate Custom Value IDs")
  }

  const creationOrdinals = new Set(
    candidateCustomValues.map(({ creationOrdinal }) => creationOrdinal),
  )
  if (creationOrdinals.size !== candidateCustomValues.length) {
    throw new Error(
      "Active Deck contains duplicate Custom Value creation ordinals",
    )
  }

  const customValues = Object.freeze(
    candidateCustomValues.map(freezeCustomValue).sort(compareCustomValues),
  )
  const values = Object.freeze([...CANONICAL_VALUES, ...customValues])
  const valueIds = Object.freeze(values.map(({ id }) => id))

  return Object.freeze({
    catalogVersion: CANONICAL_CATALOG_VERSION,
    customValues,
    values,
    valueIds,
    fingerprint: createActiveDeckFingerprint(customValues),
  }) satisfies ActiveDeck
}

export function getPairCount(activeValueCount: number) {
  if (!Number.isSafeInteger(activeValueCount) || activeValueCount < 2) {
    throw new Error(`Invalid active value count: ${activeValueCount}`)
  }

  const pairCount = (activeValueCount * (activeValueCount - 1)) / 2
  if (!Number.isSafeInteger(pairCount)) {
    throw new Error(
      `Unsafe pair count for active value count: ${activeValueCount}`,
    )
  }

  return pairCount
}
