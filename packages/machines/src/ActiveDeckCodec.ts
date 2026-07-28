import { createActiveDeck, type ActiveDeck } from "@game/data/src/ActiveDeck"
import {
  CANONICAL_CATALOG_VERSION,
  createCustomValueId,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import {
  readIsoTimestamp,
  readPositiveSafeInteger,
  readString,
  readTuple,
} from "./PersistenceValidation"

export const ACTIVE_DECK_CODEC_VERSION = 1 as const

type EncodedCustomValueDefinition = readonly [
  id: string,
  name: string,
  definition: string,
  creationOrdinal: number,
  createdAt: string,
  updatedAt: string,
]

export type EncodedActiveDeck = readonly [
  version: number,
  canonicalCatalogVersion: string,
  fingerprint: string,
  customValues: readonly EncodedCustomValueDefinition[],
]

function encodeCustomValueDefinition(
  customValue: CustomValueDefinition,
): EncodedCustomValueDefinition {
  return [
    customValue.id,
    customValue.name,
    customValue.definition,
    customValue.creationOrdinal,
    customValue.createdAt,
    customValue.updatedAt,
  ]
}

function decodeCustomValueDefinition(value: unknown, index: number) {
  const label = `Custom Value ${index}`
  const tuple = readTuple(value, 6, label)

  return Object.freeze({
    kind: "custom",
    id: createCustomValueId(readString(tuple[0], `${label} ID`)),
    name: readString(tuple[1], `${label} name`),
    definition: readString(tuple[2], `${label} definition`),
    creationOrdinal: readPositiveSafeInteger(
      tuple[3],
      `${label} creation ordinal`,
    ),
    createdAt: readIsoTimestamp(tuple[4], `${label} created timestamp`),
    updatedAt: readIsoTimestamp(tuple[5], `${label} updated timestamp`),
  }) satisfies CustomValueDefinition
}

export function encodeActiveDeck(activeDeck: ActiveDeck): EncodedActiveDeck {
  return [
    ACTIVE_DECK_CODEC_VERSION,
    activeDeck.catalogVersion,
    activeDeck.fingerprint,
    activeDeck.customValues.map(encodeCustomValueDefinition),
  ]
}

export function decodeActiveDeck(value: unknown) {
  const tuple = readTuple(value, 4, "Active Deck")
  const version = tuple[0]
  const catalogVersion = readString(tuple[1], "Active Deck catalog version")
  const fingerprint = readString(tuple[2], "Active Deck fingerprint")
  const encodedCustomValues = tuple[3]

  if (version !== ACTIVE_DECK_CODEC_VERSION) {
    throw new Error(`Unsupported Active Deck codec version: ${String(version)}`)
  }
  if (catalogVersion !== CANONICAL_CATALOG_VERSION) {
    throw new Error(`Unsupported canonical catalog version: ${catalogVersion}`)
  }
  if (!Array.isArray(encodedCustomValues)) {
    throw new Error("Invalid Active Deck Custom Values")
  }

  const activeDeck = createActiveDeck(
    encodedCustomValues.map(decodeCustomValueDefinition),
  )
  if (activeDeck.fingerprint !== fingerprint) {
    throw new Error("Active Deck fingerprint does not match its definitions")
  }
  if (JSON.stringify(encodeActiveDeck(activeDeck)) !== JSON.stringify(value)) {
    throw new Error("Active Deck encoding is not canonical")
  }

  return activeDeck
}
