import type {
  CustomValueFieldValidation,
  CustomValueValidationCode,
} from "@game/data/src/CustomValueValidation"

const validationMessages = Object.freeze({
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

export default function CustomValueFieldFeedback({
  id,
  field,
  validation,
  maximumGraphemeCount,
  showValidationMessage,
}: {
  readonly id: string
  readonly field: "name" | "definition"
  readonly validation: CustomValueFieldValidation
  readonly maximumGraphemeCount: number
  readonly showValidationMessage: boolean
}) {
  const validationMessage = validation.validationCode
    ? validationMessages[field][validation.validationCode]
    : null

  return (
    <div id={id} className="flex flex-wrap items-start justify-between gap-2">
      <span className="text-sm font-bold">
        {validation.graphemeCount} / {maximumGraphemeCount} characters
      </span>
      {showValidationMessage && validationMessage ? (
        <span role="alert" className="text-sm font-black text-black">
          {validationMessage}
        </span>
      ) : null}
    </div>
  )
}
