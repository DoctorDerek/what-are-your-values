import { CANONICAL_VALUES } from "./CanonicalValues"
import {
  normalizeValueNameForComparison,
  type CustomValueDefinition,
  type CustomValueId,
} from "./Value"

export const CUSTOM_VALUE_NAME_MAX_GRAPHEMES = 60
export const CUSTOM_VALUE_DEFINITION_MAX_GRAPHEMES = 280

export type CustomValueValidationCode =
  "required" | "too_many_graphemes" | "prohibited_characters" | "duplicate_name"

export type CustomValueFieldValidation = Readonly<{
  value: string
  graphemeCount: number
  validationCode: CustomValueValidationCode | null
}>

export type CustomValueDraftValidation = Readonly<{
  isValid: boolean
  name: CustomValueFieldValidation
  definition: CustomValueFieldValidation
}>

const graphemeSegmenter = new Intl.Segmenter("und", {
  granularity: "grapheme",
})
const canonicalValueNameComparisonKeys = Object.freeze(
  CANONICAL_VALUES.map(({ englishName }) =>
    normalizeValueNameForComparison(englishName),
  ),
)
const prohibitedCustomValueCharacterPattern =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u

function countGraphemes(value: string) {
  return Array.from(graphemeSegmenter.segment(value)).length
}

function validateField(value: string, maximumGraphemeCount: number) {
  const trimmedValue = value.trim()
  const graphemeCount = countGraphemes(trimmedValue)
  const validationCode =
    graphemeCount === 0
      ? "required"
      : prohibitedCustomValueCharacterPattern.test(trimmedValue)
        ? "prohibited_characters"
        : graphemeCount > maximumGraphemeCount
          ? "too_many_graphemes"
          : null

  return Object.freeze({
    value: trimmedValue,
    graphemeCount,
    validationCode,
  }) satisfies CustomValueFieldValidation
}

function hasDuplicateName({
  name,
  existingCustomValues,
  excludedCustomValueId,
}: {
  readonly name: string
  readonly existingCustomValues: readonly CustomValueDefinition[]
  readonly excludedCustomValueId?: CustomValueId | null
}) {
  const comparisonKey = normalizeValueNameForComparison(name)
  return (
    canonicalValueNameComparisonKeys.includes(comparisonKey) ||
    existingCustomValues.some(
      (value) =>
        value.id !== excludedCustomValueId &&
        normalizeValueNameForComparison(value.name) === comparisonKey,
    )
  )
}

export function validateCustomValueDraft({
  name,
  definition,
  existingCustomValues,
  excludedCustomValueId,
}: {
  readonly name: string
  readonly definition: string
  readonly existingCustomValues: readonly CustomValueDefinition[]
  readonly excludedCustomValueId?: CustomValueId | null
}) {
  const nameValidation = validateField(name, CUSTOM_VALUE_NAME_MAX_GRAPHEMES)
  const definitionValidation = validateField(
    definition,
    CUSTOM_VALUE_DEFINITION_MAX_GRAPHEMES,
  )
  const validatedName =
    nameValidation.validationCode === null &&
    hasDuplicateName({
      name: nameValidation.value,
      existingCustomValues,
      excludedCustomValueId,
    })
      ? Object.freeze({
          ...nameValidation,
          validationCode: "duplicate_name",
        })
      : nameValidation

  return Object.freeze({
    isValid:
      validatedName.validationCode === null &&
      definitionValidation.validationCode === null,
    name: validatedName,
    definition: definitionValidation,
  }) satisfies CustomValueDraftValidation
}
