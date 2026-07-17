import { describe, expect, it } from "vitest"
import { createActiveDeck, getPairCount } from "./ActiveDeck"
import {
  CANONICAL_CATALOG_VERSION,
  createOtherValueId,
  type OtherValueDefinition,
} from "./Value"

function createOtherValue(
  creationOrdinal: number,
  overrides: Partial<OtherValueDefinition> = {},
): OtherValueDefinition {
  const uuidSuffix = creationOrdinal.toString().padStart(12, "0")

  return {
    kind: "other",
    id: createOtherValueId(`custom:00000000-0000-4000-8000-${uuidSuffix}`),
    name: `Other Value ${creationOrdinal}`,
    definition: `Definition ${creationOrdinal}`,
    creationOrdinal,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
    ...overrides,
  }
}

describe("Active Deck", () => {
  it("always begins with the complete canonical catalog", () => {
    const activeDeck = createActiveDeck([])

    expect(activeDeck.catalogVersion).toBe(CANONICAL_CATALOG_VERSION)
    expect(activeDeck.values).toHaveLength(100)
    expect(activeDeck.valueIds).toHaveLength(100)
    expect(activeDeck.otherValues).toEqual([])
  })

  it.each([
    [0, 100, 4_950],
    [1, 101, 5_050],
    [2, 102, 5_151],
    [3, 103, 5_253],
  ])(
    "derives the permanent K=%i pair-count fixture",
    (otherValueCount, activeValueCount, expectedPairCount) => {
      const otherValues = Array.from({ length: otherValueCount }, (_, index) =>
        createOtherValue(index + 1),
      )
      const activeDeck = createActiveDeck(otherValues)

      expect(activeDeck.values).toHaveLength(activeValueCount)
      expect(getPairCount(activeDeck.values.length)).toBe(expectedPairCount)
    },
  )

  it("orders Other Values by immutable creation ordinal", () => {
    const second = createOtherValue(2)
    const first = createOtherValue(1)
    const activeDeck = createActiveDeck([second, first])

    expect(activeDeck.otherValues.map(({ id }) => id)).toEqual([
      first.id,
      second.id,
    ])
    expect(activeDeck.values.at(100)?.id).toBe(first.id)
    expect(activeDeck.values.at(101)?.id).toBe(second.id)
  })

  it("fingerprints deck meaning independently from timestamps and input order", () => {
    const first = createOtherValue(1)
    const second = createOtherValue(2)
    const sameMeaningWithNewTimestamps = [
      createOtherValue(2, {
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      }),
      createOtherValue(1, {
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      }),
    ]

    expect(createActiveDeck([first, second]).fingerprint).toBe(
      createActiveDeck(sameMeaningWithNewTimestamps).fingerprint,
    )
    expect(createActiveDeck([first]).fingerprint).not.toBe(
      createActiveDeck([
        createOtherValue(1, { definition: "Changed definition" }),
      ]).fingerprint,
    )
  })

  it("defensively freezes the complete deck definition", () => {
    const candidate = createOtherValue(1)
    const activeDeck = createActiveDeck([candidate])

    expect(Object.isFrozen(activeDeck)).toBe(true)
    expect(Object.isFrozen(activeDeck.otherValues)).toBe(true)
    expect(Object.isFrozen(activeDeck.values)).toBe(true)
    expect(Object.isFrozen(activeDeck.valueIds)).toBe(true)
    expect(Object.isFrozen(activeDeck.otherValues[0])).toBe(true)
    expect(activeDeck.otherValues[0]).not.toBe(candidate)
  })

  it("supports finite decks beyond the paper template examples", () => {
    const otherValues = Array.from({ length: 1_000 }, (_, index) =>
      createOtherValue(index + 1),
    )
    const activeDeck = createActiveDeck(otherValues)

    expect(activeDeck.values).toHaveLength(1_100)
    expect(getPairCount(activeDeck.values.length)).toBe(604_450)
  })

  it("rejects duplicate identities and creation ordinals", () => {
    const first = createOtherValue(1)

    expect(() => createActiveDeck([first, first])).toThrow(
      "duplicate Other Value IDs",
    )
    expect(() =>
      createActiveDeck([
        first,
        createOtherValue(2, { creationOrdinal: first.creationOrdinal }),
      ]),
    ).toThrow("duplicate Other Value creation ordinals")
  })

  it("rejects malformed Other Value records", () => {
    expect(() =>
      createActiveDeck([createOtherValue(1, { creationOrdinal: 0 })]),
    ).toThrow("Invalid Other Value creation ordinal")
    expect(() =>
      createActiveDeck([createOtherValue(1, { name: "   " })]),
    ).toThrow("Other Value name is required")
    expect(() =>
      createActiveDeck([createOtherValue(1, { definition: "" })]),
    ).toThrow("Other Value definition is required")
  })
})

describe("pair count", () => {
  it("rejects invalid and unsafe deck sizes", () => {
    expect(() => getPairCount(1)).toThrow("Invalid active value count")
    expect(() => getPairCount(100.5)).toThrow("Invalid active value count")
    expect(() => getPairCount(Number.MAX_SAFE_INTEGER)).toThrow(
      "Unsafe pair count",
    )
  })
})
