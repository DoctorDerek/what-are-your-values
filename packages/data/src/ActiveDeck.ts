import { CANONICAL_VALUES } from "./CanonicalValues"
import {
  CANONICAL_CATALOG_VERSION,
  isOtherValueId,
  type ActiveValueDefinition,
  type OtherValueDefinition,
  type ValueId,
} from "./Value"

declare const activeDeckFingerprintBrand: unique symbol

export type ActiveDeckFingerprint = string & {
  readonly [activeDeckFingerprintBrand]: "active-deck"
}

export type ActiveDeck = {
  readonly catalogVersion: typeof CANONICAL_CATALOG_VERSION
  readonly otherValues: readonly OtherValueDefinition[]
  readonly values: readonly ActiveValueDefinition[]
  readonly valueIds: readonly ValueId[]
  readonly fingerprint: ActiveDeckFingerprint
}

function compareOtherValues(
  first: OtherValueDefinition,
  second: OtherValueDefinition,
) {
  if (first.creationOrdinal !== second.creationOrdinal) {
    return first.creationOrdinal - second.creationOrdinal
  }

  return first.id < second.id ? -1 : first.id > second.id ? 1 : 0
}

function freezeOtherValue(value: OtherValueDefinition) {
  return Object.freeze({ ...value })
}

function validateOtherValue(value: OtherValueDefinition) {
  if (value.kind !== "other" || !isOtherValueId(value.id)) {
    throw new Error(`Invalid Other Value identity: ${value.id}`)
  }

  if (
    !Number.isSafeInteger(value.creationOrdinal) ||
    value.creationOrdinal < 1
  ) {
    throw new Error(`Invalid Other Value creation ordinal: ${value.id}`)
  }

  if (value.name.trim().length === 0) {
    throw new Error(`Other Value name is required: ${value.id}`)
  }

  if (value.definition.trim().length === 0) {
    throw new Error(`Other Value definition is required: ${value.id}`)
  }
}

function createActiveDeckFingerprint(
  otherValues: readonly OtherValueDefinition[],
) {
  return JSON.stringify([
    CANONICAL_CATALOG_VERSION,
    otherValues.map(({ id, creationOrdinal, name, definition }) => [
      id,
      creationOrdinal,
      name,
      definition,
    ]),
  ]) as ActiveDeckFingerprint
}

export function createActiveDeck(
  candidateOtherValues: readonly OtherValueDefinition[],
) {
  candidateOtherValues.forEach(validateOtherValue)

  const otherValueIds = new Set(candidateOtherValues.map(({ id }) => id))
  if (otherValueIds.size !== candidateOtherValues.length) {
    throw new Error("Active Deck contains duplicate Other Value IDs")
  }

  const creationOrdinals = new Set(
    candidateOtherValues.map(({ creationOrdinal }) => creationOrdinal),
  )
  if (creationOrdinals.size !== candidateOtherValues.length) {
    throw new Error(
      "Active Deck contains duplicate Other Value creation ordinals",
    )
  }

  const otherValues = Object.freeze(
    candidateOtherValues.map(freezeOtherValue).sort(compareOtherValues),
  )
  const values = Object.freeze([...CANONICAL_VALUES, ...otherValues])
  const valueIds = Object.freeze(values.map(({ id }) => id))

  return Object.freeze({
    catalogVersion: CANONICAL_CATALOG_VERSION,
    otherValues,
    values,
    valueIds,
    fingerprint: createActiveDeckFingerprint(otherValues),
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
