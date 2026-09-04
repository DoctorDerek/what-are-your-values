import type {
  CanonicalValueId,
  CustomValueId,
  ValueId,
} from "@game/data/src/Value"
import { isCanonicalValueId } from "@game/data/src/Value"
import { VALUE_TO_ANIMAL_MAP } from "@game/data/src/ValueToAnimalMap"
import { ZOO_ANIMALS, type ZooAnimalId } from "@game/data/src/ZooAnimals"
import { hashText } from "./DeterministicSequence"

export const SEETHING_SWARM_CUSTOM_VALUE_ANIMAL_ASSOCIATION_VERSION = 1

export const SEETHING_SWARM_CUSTOM_VALUE_ANIMAL_ROSTER = Object.freeze(
  ZOO_ANIMALS.map(({ id }) => id),
)

export type SeethingSwarmBattleCombatant = Readonly<{
  valueId: ValueId
  animalId: ZooAnimalId
}>

const canonicalAnimalByValueId = new Map(
  VALUE_TO_ANIMAL_MAP.map(({ valueId, animalId }) => [valueId, animalId]),
)

function resolveCanonicalAnimalId(valueId: CanonicalValueId) {
  const animalId = canonicalAnimalByValueId.get(valueId)
  if (!animalId) {
    throw new Error(`Missing animal mapping for canonical value: ${valueId}`)
  }
  return animalId
}

function resolveCustomAnimalId(valueId: CustomValueId) {
  const associationIdentity = JSON.stringify([
    "seethingswarm-custom-value-animal",
    SEETHING_SWARM_CUSTOM_VALUE_ANIMAL_ASSOCIATION_VERSION,
    valueId,
  ])
  const animalIndex =
    hashText(associationIdentity) %
    SEETHING_SWARM_CUSTOM_VALUE_ANIMAL_ROSTER.length
  return SEETHING_SWARM_CUSTOM_VALUE_ANIMAL_ROSTER[animalIndex]!
}

export function resolveSeethingSwarmBattleCombatant(valueId: ValueId) {
  return Object.freeze({
    valueId,
    animalId: isCanonicalValueId(valueId)
      ? resolveCanonicalAnimalId(valueId)
      : resolveCustomAnimalId(valueId),
  }) satisfies SeethingSwarmBattleCombatant
}
