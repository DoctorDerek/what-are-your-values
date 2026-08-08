import { describe, expect, it } from "vitest"
import { customValueValidationMessages } from "./CustomValueValidationMessages"

describe("Custom Value Validation Messages", () => {
  it("owns complete frozen feedback for both authored fields", () => {
    expect(customValueValidationMessages).toEqual({
      name: {
        required: "Enter a name for this value.",
        too_many_graphemes: "Use 60 or fewer characters for the value name.",
        prohibited_characters:
          "Remove invisible or control characters from the value name.",
        duplicate_name: "This value already exists. Open it instead.",
      },
      definition: {
        required: "Enter a short personal definition for this value.",
        too_many_graphemes:
          "Use 280 or fewer characters for the personal definition.",
        prohibited_characters:
          "Remove invisible or control characters from the personal definition.",
        duplicate_name: "",
      },
    })
    expect(Object.isFrozen(customValueValidationMessages)).toBe(true)
    expect(Object.isFrozen(customValueValidationMessages.name)).toBe(true)
    expect(Object.isFrozen(customValueValidationMessages.definition)).toBe(true)
  })
})
