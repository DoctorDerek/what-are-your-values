import type { SeethingSwarmPublicFallbackRegistry } from "./SeethingSwarmAnimalRegistry"
import { ZOO_ANIMALS } from "./ZooAnimals"

export const SEETHING_SWARM_PUBLIC_PLACEHOLDER_ID =
  "original-neutral-animal-placeholder"

export const SEETHING_SWARM_PLACEHOLDER_REGISTRY = Object.freeze({
  animals: Object.freeze(
    ZOO_ANIMALS.map(({ id }) =>
      Object.freeze({
        animalId: id,
        placeholderId: SEETHING_SWARM_PUBLIC_PLACEHOLDER_ID,
      }),
    ),
  ),
}) satisfies SeethingSwarmPublicFallbackRegistry
