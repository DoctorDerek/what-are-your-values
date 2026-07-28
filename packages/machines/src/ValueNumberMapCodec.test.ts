import { describe, expect, it } from "vitest"
import { createInitialBattleCycle } from "./BattleCycle"
import {
  decodeCompleteValueNumberMap,
  encodeValueNumberEntries,
} from "./ValueNumberMapCodec"

describe("Value Number Map Codec", () => {
  it("decodes complete maps into canonical Active Deck order", () => {
    const { activeDeck } = createInitialBattleCycle("value-number-map-seed")
    const reversedEntries = activeDeck.valueIds
      .map((valueId, index) => [valueId, index + 1] as const)
      .reverse()

    const decoded = decodeCompleteValueNumberMap(
      activeDeck,
      reversedEntries,
      "Levels",
      1,
    )

    expect(Array.from(decoded.keys())).toEqual(activeDeck.valueIds)
    expect(encodeValueNumberEntries(decoded)).toEqual(
      activeDeck.valueIds.map((valueId, index) => [valueId, index + 1]),
    )
  })

  it("rejects incomplete, duplicate, inactive, and below-bound entries", () => {
    const { activeDeck } = createInitialBattleCycle(
      "invalid-value-number-map-seed",
    )
    const entries = activeDeck.valueIds.map((valueId) => [valueId, 1] as const)

    expect(() =>
      decodeCompleteValueNumberMap(activeDeck, entries.slice(1), "Levels", 1),
    ).toThrow("Levels does not cover the complete Active Deck")
    expect(() =>
      decodeCompleteValueNumberMap(
        activeDeck,
        [entries[0], entries[0], ...entries.slice(2)],
        "Levels",
        1,
      ),
    ).toThrow(`Levels contains duplicate Value ID: ${entries[0][0]}`)
    expect(() =>
      decodeCompleteValueNumberMap(
        activeDeck,
        [
          ["custom:00000000-0000-4000-8000-000000000000", 1],
          ...entries.slice(1),
        ],
        "Levels",
        1,
      ),
    ).toThrow("Levels Value ID is not in the Active Deck")
    expect(() =>
      decodeCompleteValueNumberMap(
        activeDeck,
        [[entries[0][0], 0], ...entries.slice(1)],
        "Levels",
        1,
      ),
    ).toThrow(`Invalid Levels value for ${entries[0][0]}: 0`)
  })
})
