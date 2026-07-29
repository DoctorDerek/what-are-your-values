import { describe, expect, it } from "vitest"
import {
  CUSTOM_VALUE_DEFINITION_MAX_GRAPHEMES,
  CUSTOM_VALUE_NAME_MAX_GRAPHEMES,
  validateCustomValueDraft,
} from "./CustomValueValidation"
import { createCustomValueId, type CustomValueDefinition } from "./Value"

const existingCustomValue = Object.freeze({
  kind: "custom",
  id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
  name: "Straße",
  definition: "A path traveled with purpose.",
  creationOrdinal: 1,
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
}) satisfies CustomValueDefinition

function validateDraft({
  name = "Ingenuity",
  definition = "To solve problems in original and resourceful ways.",
  existingCustomValues = [],
  excludedCustomValueId,
}: {
  readonly name?: string
  readonly definition?: string
  readonly existingCustomValues?: readonly CustomValueDefinition[]
  readonly excludedCustomValueId?: CustomValueDefinition["id"]
} = {}) {
  return validateCustomValueDraft({
    name,
    definition,
    existingCustomValues,
    excludedCustomValueId,
  })
}

describe("Custom Value Validation", () => {
  it("accepts and visibly trims legitimate multilingual text and joined emoji", () => {
    const validation = validateDraft({
      name: "  سرنوشت  ",
      definition: "خانواده، دوستی، و مراقبت 👨‍👩‍👧‍👦",
    })

    expect(validation).toEqual({
      isValid: true,
      name: {
        value: "سرنوشت",
        graphemeCount: 6,
        validationCode: null,
      },
      definition: {
        value: "خانواده، دوستی، و مراقبت 👨‍👩‍👧‍👦",
        graphemeCount: 26,
        validationCode: null,
      },
    })
  })

  it("counts grapheme clusters rather than UTF-16 code units at both limits", () => {
    const validName = "🦝".repeat(CUSTOM_VALUE_NAME_MAX_GRAPHEMES)
    const validDefinition = "é".repeat(CUSTOM_VALUE_DEFINITION_MAX_GRAPHEMES)

    expect(
      validateDraft({ name: validName, definition: validDefinition }).isValid,
    ).toBe(true)
    expect(validateDraft({ name: `${validName}🦝` }).name.validationCode).toBe(
      "too_many_graphemes",
    )
    expect(
      validateDraft({
        definition: `${validDefinition}é`,
      }).definition.validationCode,
    ).toBe("too_many_graphemes")
  })

  it("requires both fields and rejects control or bidirectional override characters", () => {
    expect(validateDraft({ name: "   " }).name.validationCode).toBe("required")
    expect(validateDraft({ definition: "\n" }).definition.validationCode).toBe(
      "required",
    )
    expect(validateDraft({ name: "Meaning\u202e" }).name.validationCode).toBe(
      "prohibited_characters",
    )
    expect(
      validateDraft({ definition: "Purpose\u0000" }).definition.validationCode,
    ).toBe("prohibited_characters")
  })

  it("blocks compatibility and case-folded collisions with canonical names", () => {
    const validation = validateDraft({ name: "ＦＵＮ" })

    expect(validation.isValid).toBe(false)
    expect(validation.name.validationCode).toBe("duplicate_name")
  })

  it("blocks other Custom Value names but permits an unchanged edited identity", () => {
    expect(
      validateDraft({
        name: "STRASSE",
        existingCustomValues: [existingCustomValue],
      }).name.validationCode,
    ).toBe("duplicate_name")
    expect(
      validateDraft({
        name: "STRASSE",
        existingCustomValues: [existingCustomValue],
        excludedCustomValueId: existingCustomValue.id,
      }).isValid,
    ).toBe(true)
  })
})
