import { describe, expect, it } from "vitest"
import { CUSTOM_VALUE_STARTER_EXAMPLES } from "./CustomValueStarterExamples"

describe("Custom Value Starter Examples", () => {
  it("provides the three approved editable unsaved drafts in canonical order", () => {
    expect(CUSTOM_VALUE_STARTER_EXAMPLES).toEqual([
      {
        name: "Ingenuity",
        definition:
          "To solve problems in original, resourceful, and practical ways.",
        label: "Mapachito’s example",
      },
      {
        name: "Destiny",
        definition: "To pursue the path I believe I am meant to fulfill.",
        label: null,
      },
      {
        name: "Pets",
        definition:
          "To care for, protect, and share life with companion animals.",
        label: null,
      },
    ])
    expect(Object.isFrozen(CUSTOM_VALUE_STARTER_EXAMPLES)).toBe(true)
    expect(
      CUSTOM_VALUE_STARTER_EXAMPLES.every((example) =>
        Object.isFrozen(example),
      ),
    ).toBe(true)
  })
})
