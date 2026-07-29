import type { CustomValueDefinition, CustomValueId } from "@game/data/src/Value"
import { createCustomValueId } from "@game/data/src/Value"
import type { BattleProfile } from "./BattleProfile"
import { createDeckRevisionCommit } from "./BattleProfileCommit"

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
  const trimmedName = name.trim()
  const trimmedDefinition = definition.trim()

  if (trimmedName.length === 0) {
    throw new Error("Custom Value name is required")
  }

  if (trimmedDefinition.length === 0) {
    throw new Error("Custom Value definition is required")
  }

  const nextCreationOrdinal =
    existingCustomValues.reduce(
      (maxOrdinal, value) =>
        value.creationOrdinal > maxOrdinal ? value.creationOrdinal : maxOrdinal,
      0,
    ) + 1

  return Object.freeze({
    kind: "custom",
    id: createCustomValueId(`custom:${crypto.randomUUID()}`),
    name: trimmedName,
    definition: trimmedDefinition,
    creationOrdinal: nextCreationOrdinal,
    createdAt: now(),
    updatedAt: now(),
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
  const revisedCustomValues = Object.freeze([
    ...profile.activeDeck.customValues,
    createNextCustomValue({
      existingCustomValues: profile.activeDeck.customValues,
      name,
      definition,
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
  const trimmedName = name.trim()
  const trimmedDefinition = definition.trim()

  if (trimmedName.length === 0) {
    throw new Error("Custom Value name is required")
  }

  if (trimmedDefinition.length === 0) {
    throw new Error("Custom Value definition is required")
  }

  const revisedCustomValues = Object.freeze(
    profile.activeDeck.customValues.map((value) => {
      if (value.id !== valueId) {
        return value
      }

      return Object.freeze({
        ...value,
        name: trimmedName,
        definition: trimmedDefinition,
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
