import type { SeethingSwarmAnimalManifest } from "./SeethingSwarmAnimalManifest"
import { SEETHING_SWARM_SOURCE_SNAPSHOT } from "./SeethingSwarmSourceEvidence"
import { ZOO_ANIMALS, type ZooAnimalId } from "./ZooAnimals"

export type SeethingSwarmAnimalRegistry = Readonly<{
  evidenceSnapshotId: string
  animals: readonly SeethingSwarmAnimalManifest[]
  characterAnimationCount: number
  auxiliaryEffectCount: number
}>

export type SeethingSwarmPublicFallback = Readonly<{
  animalId: ZooAnimalId
  placeholderId: string
}>

export type SeethingSwarmPublicFallbackRegistry = Readonly<{
  animals: readonly SeethingSwarmPublicFallback[]
}>

function freezeAnimalManifest(manifest: SeethingSwarmAnimalManifest) {
  for (const animation of Object.values(manifest.animations)) {
    Object.freeze(animation)
  }
  Object.freeze(manifest.animations)

  if (manifest.auxiliaryEffects) {
    for (const effect of Object.values(manifest.auxiliaryEffects)) {
      Object.freeze(effect)
    }
    Object.freeze(manifest.auxiliaryEffects)
  }

  return Object.freeze(manifest)
}

function assertCanonicalAnimalOrder(
  manifests: readonly SeethingSwarmAnimalManifest[],
) {
  if (manifests.length !== ZOO_ANIMALS.length) {
    throw new Error(
      `Invalid SeethingSwarm registry animal count: ${manifests.length}`,
    )
  }

  for (const [index, expectedAnimal] of ZOO_ANIMALS.entries()) {
    const actualAnimalId = manifests[index]?.animalId
    if (actualAnimalId !== expectedAnimal.id) {
      throw new Error(
        `Invalid SeethingSwarm registry animal at position ${index}: expected ${expectedAnimal.id}, received ${actualAnimalId ?? "missing"}`,
      )
    }
  }
}

function assertEvidenceSnapshot(
  manifests: readonly SeethingSwarmAnimalManifest[],
) {
  for (const manifest of manifests) {
    if (
      manifest.evidenceSnapshotId !==
      SEETHING_SWARM_SOURCE_SNAPSHOT.sourceSnapshotId
    ) {
      throw new Error(
        `Invalid SeethingSwarm evidence snapshot for ${manifest.animalId}: ${manifest.evidenceSnapshotId}`,
      )
    }
  }
}

export function createSeethingSwarmAnimalRegistry(
  manifests: readonly SeethingSwarmAnimalManifest[],
) {
  assertCanonicalAnimalOrder(manifests)
  assertEvidenceSnapshot(manifests)

  const characterAnimationCount = manifests.reduce(
    (count, manifest) => count + Object.keys(manifest.animations).length,
    0,
  )
  const auxiliaryEffectCount = manifests.reduce(
    (count, manifest) =>
      count + Object.keys(manifest.auxiliaryEffects ?? {}).length,
    0,
  )

  if (
    characterAnimationCount !==
    SEETHING_SWARM_SOURCE_SNAPSHOT.characterAnimationStripCount
  ) {
    throw new Error(
      `Invalid SeethingSwarm character animation count: ${characterAnimationCount}`,
    )
  }
  if (
    auxiliaryEffectCount !==
    SEETHING_SWARM_SOURCE_SNAPSHOT.auxiliaryEffectStripCount
  ) {
    throw new Error(
      `Invalid SeethingSwarm auxiliary effect count: ${auxiliaryEffectCount}`,
    )
  }

  return Object.freeze({
    evidenceSnapshotId: SEETHING_SWARM_SOURCE_SNAPSHOT.sourceSnapshotId,
    animals: Object.freeze(manifests.map(freezeAnimalManifest)),
    characterAnimationCount,
    auxiliaryEffectCount,
  }) satisfies SeethingSwarmAnimalRegistry
}
