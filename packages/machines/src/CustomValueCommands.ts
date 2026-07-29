import {
  CUSTOM_VALUE_DEFINITION_MAX_GRAPHEMES,
  CUSTOM_VALUE_NAME_MAX_GRAPHEMES,
  validateCustomValueDraft,
  type CustomValueValidationCode,
} from "@game/data/src/CustomValueValidation"
import type { CustomValueDefinition, CustomValueId } from "@game/data/src/Value"
import { createCustomValueId } from "@game/data/src/Value"
import type { BattleProfile } from "./BattleProfile"
import { createDeckRevisionCommit } from "./BattleProfileCommit"

function getValidationErrorMessage(
  field: "name" | "definition",
  validationCode: CustomValueValidationCode,
) {
  if (validationCode === "required") {
    return `Custom Value ${field} is required`
  }

  if (validationCode === "duplicate_name") {
    return "Custom Value name already exists"
  }

  if (validationCode === "prohibited_characters") {
    return `Custom Value ${field} contains prohibited control characters`
  }

  const maximumGraphemeCount =
    field === "name"
      ? CUSTOM_VALUE_NAME_MAX_GRAPHEMES
      : CUSTOM_VALUE_DEFINITION_MAX_GRAPHEMES
  return `Custom Value ${field} cannot exceed ${maximumGraphemeCount} grapheme clusters`
}

function requireValidCustomValueDraft({
  existingCustomValues,
  name,
  definition,
  excludedCustomValueId,
}: {
  readonly existingCustomValues: readonly CustomValueDefinition[]
  readonly name: string
  readonly definition: string
  readonly excludedCustomValueId?: CustomValueId | null
}) {
  const validation = validateCustomValueDraft({
    name,
    definition,
    existingCustomValues,
    excludedCustomValueId,
  })

  if (validation.name.validationCode) {
    throw new Error(
      getValidationErrorMessage("name", validation.name.validationCode),
    )
  }

  if (validation.definition.validationCode) {
    throw new Error(
      getValidationErrorMessage(
        "definition",
        validation.definition.validationCode,
      ),
    )
  }

  return Object.freeze({
    name: validation.name.value,
    definition: validation.definition.value,
  })
}

function createNextCustomValue({
  existingCustomValues,
  name,
  definition,
  now,
}: {
  readonly existingCustomValues: readonly CustomValueDefinition[]
  readonly name: string
  readonly definition: string
  readonly now: () => string
}) {
  const nextCreationOrdinal =
    existingCustomValues.reduce(
      (maxOrdinal, value) =>
        value.creationOrdinal > maxOrdinal ? value.creationOrdinal : maxOrdinal,
      0,
    ) + 1
  const timestamp = now()

  return Object.freeze({
    kind: "custom",
    id: createCustomValueId(`custom:${crypto.randomUUID()}`),
    name,
    definition,
    creationOrdinal: nextCreationOrdinal,
    createdAt: timestamp,
    updatedAt: timestamp,
  }) satisfies CustomValueDefinition
}

export function createCustomValueAddCommit({
  profile,
  name,
  definition,
  now,
}: {
  readonly profile: BattleProfile
  readonly name: string
  readonly definition: string
  readonly now: () => string
}) {
  const validatedDraft = requireValidCustomValueDraft({
    existingCustomValues: profile.activeDeck.customValues,
    name,
    definition,
  })
  const revisedCustomValues = Object.freeze([
    ...profile.activeDeck.customValues,
    createNextCustomValue({
      existingCustomValues: profile.activeDeck.customValues,
      name: validatedDraft.name,
      definition: validatedDraft.definition,
      now,
    }),
  ])

  return createDeckRevisionCommit({ profile, revisedCustomValues })
}

export function createCustomValueUpdateCommit({
  profile,
  valueId,
  name,
  definition,
  now,
}: {
  readonly profile: BattleProfile
  readonly valueId: CustomValueId
  readonly name: string
  readonly definition: string
  readonly now: () => string
}) {
  const validatedDraft = requireValidCustomValueDraft({
    existingCustomValues: profile.activeDeck.customValues,
    name,
    definition,
    excludedCustomValueId: valueId,
  })

  const revisedCustomValues = Object.freeze(
    profile.activeDeck.customValues.map((value) => {
      if (value.id !== valueId) {
        return value
      }

      return Object.freeze({
        ...value,
        name: validatedDraft.name,
        definition: validatedDraft.definition,
        updatedAt: now(),
      })
    }),
  )

  if (
    !revisedCustomValues.some((value) => value.id === valueId) ||
    profile.activeDeck.customValues.every((value) => value.id !== valueId)
  ) {
    throw new Error(`Custom Value does not exist: ${valueId}`)
  }

  return createDeckRevisionCommit({ profile, revisedCustomValues })
}

export function createCustomValueDeleteCommit({
  profile,
  valueId,
}: {
  readonly profile: BattleProfile
  readonly valueId: CustomValueId
}) {
  const revisedCustomValues = profile.activeDeck.customValues.filter(
    (value) => value.id !== valueId,
  )

  if (revisedCustomValues.length === profile.activeDeck.customValues.length) {
    throw new Error(`Custom Value does not exist: ${valueId}`)
  }

  return createDeckRevisionCommit({
    profile,
    revisedCustomValues: Object.freeze(revisedCustomValues),
  })
}
