import { createActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import { describe, expect, it } from "vitest"
import { decodeActiveDeck, encodeActiveDeck } from "./ActiveDeckCodec"

function createCustomValue(creationOrdinal: number): CustomValueDefinition {
  const uuidSuffix = creationOrdinal.toString().padStart(12, "0")

  return {
    kind: "custom",
    id: createCustomValueId(`custom:00000000-0000-4000-8000-${uuidSuffix}`),
    name: `Custom ${creationOrdinal}`,
    definition: `Definition ${creationOrdinal}`,
    creationOrdinal,
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
  }
}

describe("Active Deck Codec", () => {
  it("round-trips canonical and player-authored definitions in stable order", () => {
    const activeDeck = createActiveDeck([
      createCustomValue(2),
      createCustomValue(1),
    ])
    const encoded = encodeActiveDeck(activeDeck)

    expect(decodeActiveDeck(encoded)).toEqual(activeDeck)
    expect(encoded[3].map(([id]) => id)).toEqual(
      activeDeck.customValues.map(({ id }) => id),
    )
  })

  it("rejects unsupported versions, altered definitions, and invalid timestamps", () => {
    const activeDeck = createActiveDeck([createCustomValue(1)])
    const encoded = encodeActiveDeck(activeDeck)
    const [customValue] = encoded[3]

    expect(() => decodeActiveDeck([2, ...encoded.slice(1)])).toThrow(
      "Unsupported Active Deck codec version",
    )
    expect(() =>
      decodeActiveDeck([encoded[0], "future-catalog", encoded[2], encoded[3]]),
    ).toThrow("Unsupported canonical catalog version")
    expect(() =>
      decodeActiveDeck([
        ...encoded.slice(0, 3),
        [[customValue[0], "Altered", ...customValue.slice(2)]],
      ]),
    ).toThrow("Active Deck fingerprint does not match its definitions")
    expect(() =>
      decodeActiveDeck([
        ...encoded.slice(0, 3),
        [[...customValue.slice(0, 4), "invalid", customValue[5]]],
      ]),
    ).toThrow("Invalid Custom Value 0 created timestamp")
  })

  it("rejects noncanonical Custom Value ordering", () => {
    const activeDeck = createActiveDeck([
      createCustomValue(1),
      createCustomValue(2),
    ])
    const encoded = encodeActiveDeck(activeDeck)

    expect(() =>
      decodeActiveDeck([...encoded.slice(0, 3), [...encoded[3]].reverse()]),
    ).toThrow("Active Deck encoding is not canonical")
  })
})
