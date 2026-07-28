import { describe, expect, it } from "vitest"
import { CANONICAL_VALUES } from "./CanonicalValues"
import {
  createCustomValueId,
  getValueDisplayDefinition,
  getValueDisplayName,
  normalizeValueNameForComparison,
  type CustomValueDefinition,
} from "./Value"

describe("Value presentation copy", () => {
  it("projects canonical source copy without changing identity", () => {
    const curiosity = CANONICAL_VALUES[22]

    expect(getValueDisplayName(curiosity)).toBe("Curiosity")
    expect(getValueDisplayDefinition(curiosity)).toBe(
      "to seek out, experience, and learn new things",
    )
  })

  it("projects private Custom Value copy through the same interface", () => {
    const ingenuity = {
      kind: "custom",
      id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
      name: "Ingenuity",
      definition: "To solve problems in original and resourceful ways.",
      creationOrdinal: 1,
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
    } satisfies CustomValueDefinition

    expect(getValueDisplayName(ingenuity)).toBe("Ingenuity")
    expect(getValueDisplayDefinition(ingenuity)).toBe(
      "To solve problems in original and resourceful ways.",
    )
  })

  it("normalizes exact value-name comparisons without changing player copy", () => {
    expect(normalizeValueNameForComparison("  Ingenuity  ")).toBe("ingenuity")
    expect(normalizeValueNameForComparison("INGEN\u2009UITY")).toBe(
      "ingen uity",
    )
  })
})
