import type { CustomValueValidationCode } from "./CustomValueValidation"

export const customValueValidationMessages = Object.freeze({
  name: Object.freeze({
    required: "Enter a name for this value.",
    too_many_graphemes: "Use 60 or fewer characters for the value name.",
    prohibited_characters:
      "Remove invisible or control characters from the value name.",
    duplicate_name: "This value already exists. Open it instead.",
  }),
  definition: Object.freeze({
    required: "Enter a short personal definition for this value.",
    too_many_graphemes:
      "Use 280 or fewer characters for the personal definition.",
    prohibited_characters:
      "Remove invisible or control characters from the personal definition.",
    duplicate_name: "",
  }),
}) satisfies Readonly<
  Record<
    "name" | "definition",
    Readonly<Record<CustomValueValidationCode, string>>
  >
>
