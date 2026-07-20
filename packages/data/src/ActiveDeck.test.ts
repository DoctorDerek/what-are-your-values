import { describe, expect, it } from "vitest"
import { createActiveDeck, getPairCount } from "./ActiveDeck"
import {
  CANONICAL_CATALOG_VERSION,
  createCustomValueId,
  type CustomValueDefinition,
  type CustomValueId,
} from "./Value"

function createCustomValue(
  creationOrdinal: number,
  overrides: Partial<CustomValueDefinition> = {},
): CustomValueDefinition {
  const uuidSuffix = creationOrdinal.toString().padStart(12, "0")

  return {
    kind: "custom",
    id: createCustomValueId(`custom:00000000-0000-4000-8000-${uuidSuffix}`),
    name: `Custom Value ${creationOrdinal}`,
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
    expect(activeDeck.customValues).toEqual([])
  })

  it.each([
    [0, 100, 4_950],
    [1, 101, 5_050],
    [2, 102, 5_151],
    [3, 103, 5_253],
  ])(
    "derives the permanent K=%i pair-count fixture",
    (customValueCount, activeValueCount, expectedPairCount) => {
      const customValues = Array.from(
        { length: customValueCount },
        (_, index) => createCustomValue(index + 1),
      )
      const activeDeck = createActiveDeck(customValues)

      expect(activeDeck.values).toHaveLength(activeValueCount)
      expect(getPairCount(activeDeck.values.length)).toBe(expectedPairCount)
    },
  )

  it("orders Custom Values by immutable creation ordinal", () => {
    const second = createCustomValue(2)
    const first = createCustomValue(1)
    const activeDeck = createActiveDeck([second, first])

    expect(activeDeck.customValues.map(({ id }) => id)).toEqual([
      first.id,
      second.id,
    ])
    expect(activeDeck.values.at(100)?.id).toBe(first.id)
    expect(activeDeck.values.at(101)?.id).toBe(second.id)
  })

  it("fingerprints deck meaning independently from timestamps and input order", () => {
    const first = createCustomValue(1)
    const second = createCustomValue(2)
    const sameMeaningWithNewTimestamps = [
      createCustomValue(2, {
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      }),
      createCustomValue(1, {
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      }),
    ]

    expect(createActiveDeck([first, second]).fingerprint).toBe(
      createActiveDeck(sameMeaningWithNewTimestamps).fingerprint,
    )
    expect(createActiveDeck([first]).fingerprint).not.toBe(
      createActiveDeck([
        createCustomValue(1, { definition: "Changed definition" }),
      ]).fingerprint,
    )
  })

  it("defensively freezes the complete deck definition", () => {
    const candidate = createCustomValue(1)
    const activeDeck = createActiveDeck([candidate])

    expect(Object.isFrozen(activeDeck)).toBe(true)
    expect(Object.isFrozen(activeDeck.customValues)).toBe(true)
    expect(Object.isFrozen(activeDeck.values)).toBe(true)
    expect(Object.isFrozen(activeDeck.valueIds)).toBe(true)
    expect(Object.isFrozen(activeDeck.customValues[0])).toBe(true)
    expect(activeDeck.customValues[0]).not.toBe(candidate)
  })

  it("supports finite decks beyond the paper template examples", () => {
    const customValues = Array.from({ length: 1_000 }, (_, index) =>
      createCustomValue(index + 1),
    )
    const activeDeck = createActiveDeck(customValues)

    expect(activeDeck.values).toHaveLength(1_100)
    expect(getPairCount(activeDeck.values.length)).toBe(604_450)
  })

  it("rejects duplicate identities and creation ordinals", () => {
    const first = createCustomValue(1)

    expect(() => createActiveDeck([first, first])).toThrow(
      "duplicate Custom Value IDs",
    )
    expect(() =>
      createActiveDeck([
        first,
        createCustomValue(2, { creationOrdinal: first.creationOrdinal }),
      ]),
    ).toThrow("duplicate Custom Value creation ordinals")
  })

  it("rejects malformed Custom Value records", () => {
    expect(() =>
      createActiveDeck([
        createCustomValue(1, {
          id: "pvcs-2011:acceptance" as CustomValueId,
        }),
      ]),
    ).toThrow("Invalid Custom Value identity")
    expect(() =>
      createActiveDeck([createCustomValue(1, { creationOrdinal: 0 })]),
    ).toThrow("Invalid Custom Value creation ordinal")
    expect(() =>
      createActiveDeck([createCustomValue(1, { name: "   " })]),
    ).toThrow("Custom Value name is required")
    expect(() =>
      createActiveDeck([createCustomValue(1, { definition: "" })]),
    ).toThrow("Custom Value definition is required")
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
