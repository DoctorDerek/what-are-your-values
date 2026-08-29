import { describe, expect, it } from "vitest"
import {
  createSeethingSwarmAnimalManifest,
  type SeethingSwarmAnimalManifest,
  type SeethingSwarmAnimalManifestInput,
} from "./SeethingSwarmAnimalManifest"
import { createSeethingSwarmAnimalRegistry } from "./SeethingSwarmAnimalRegistry"
import { SEETHING_SWARM_SOURCE_SNAPSHOT } from "./SeethingSwarmSourceEvidence"
import { ZOO_ANIMALS, type ZooAnimalId } from "./ZooAnimals"

const frogpackAnimalIndex = ZOO_ANIMALS.findIndex(({ id }) => id === "frogpack")

type TestManifestOverrides = Readonly<{
  animalId?: ZooAnimalId
  animationCount?: number
  auxiliaryEffectCount?: number
  evidenceSnapshotId?: string
}>

function createTestManifest(
  animalIndex: number,
  overrides: TestManifestOverrides = {},
) {
  const animalId = overrides.animalId ?? ZOO_ANIMALS[animalIndex]!.id
  const familyId = `animal_${animalIndex}`
  const sourceRelativePath = `${familyId}_spritesheets`
  const animationCount =
    overrides.animationCount ?? (animalIndex === 0 ? 26 : 17)
  const auxiliaryEffectCount =
    overrides.auxiliaryEffectCount ??
    (animalIndex === frogpackAnimalIndex ? 1 : 0)

  return createSeethingSwarmAnimalManifest({
    animalId,
    familyId,
    sourceRelativePath,
    sourceColorLabel: "neutral",
    frameWidth: 32,
    frameHeight: 32,
    animations: Object.freeze(
      Array.from({ length: animationCount }, (_, animationIndex) =>
        Object.freeze({
          animationId: `animation_${animationIndex}`,
          relativePath: `${sourceRelativePath}/animation_${animationIndex}.png`,
          frameCount: 4,
        }),
      ),
    ),
    ...(auxiliaryEffectCount > 0
      ? {
          auxiliaryEffects: Object.freeze(
            Array.from({ length: auxiliaryEffectCount }, (_, effectIndex) =>
              Object.freeze({
                effectId: `effect_${effectIndex}`,
                relativePath: `${sourceRelativePath}/effect_${effectIndex}.png`,
                frameWidth: 8,
                frameHeight: 6,
                frameCount: 2,
              }),
            ),
          ),
        }
      : {}),
    evidenceSnapshotId:
      overrides.evidenceSnapshotId ??
      SEETHING_SWARM_SOURCE_SNAPSHOT.sourceSnapshotId,
  } satisfies SeethingSwarmAnimalManifestInput)
}

function createCompleteTestManifests() {
  return ZOO_ANIMALS.map((_, animalIndex) => createTestManifest(animalIndex))
}

function replaceManifest(
  manifests: readonly SeethingSwarmAnimalManifest[],
  index: number,
  replacement: SeethingSwarmAnimalManifest,
) {
  return manifests.map((manifest, manifestIndex) =>
    manifestIndex === index ? replacement : manifest,
  )
}

describe("SeethingSwarm animal registry", () => {
  it("accepts the complete canonical collection and derives audited totals", () => {
    const registry = createSeethingSwarmAnimalRegistry(
      createCompleteTestManifests(),
    )

    expect(registry.evidenceSnapshotId).toBe(
      SEETHING_SWARM_SOURCE_SNAPSHOT.sourceSnapshotId,
    )
    expect(registry.animals.map(({ animalId }) => animalId)).toEqual(
      ZOO_ANIMALS.map(({ id }) => id),
    )
    expect(registry.characterAnimationCount).toBe(774)
    expect(registry.auxiliaryEffectCount).toBe(1)
  })

  it("deeply freezes the complete registry collection", () => {
    const registry = createSeethingSwarmAnimalRegistry(
      createCompleteTestManifests(),
    )

    expect(Object.isFrozen(registry)).toBe(true)
    expect(Object.isFrozen(registry.animals)).toBe(true)
    expect(registry.animals.every(Object.isFrozen)).toBe(true)
    expect(
      registry.animals.every(({ animations }) => Object.isFrozen(animations)),
    ).toBe(true)
    expect(
      registry.animals.every(({ animations }) =>
        Object.values(animations).every(Object.isFrozen),
      ),
    ).toBe(true)

    const auxiliaryEffects =
      registry.animals[frogpackAnimalIndex]!.auxiliaryEffects!
    expect(Object.isFrozen(auxiliaryEffects)).toBe(true)
    expect(Object.values(auxiliaryEffects).every(Object.isFrozen)).toBe(true)
  })

  it("rejects missing duplicate unknown and out-of-order animal identities", () => {
    const manifests = createCompleteTestManifests()
    const unknownAnimalManifest = {
      ...manifests[0]!,
      animalId: "unknown-animal",
    } as unknown as SeethingSwarmAnimalManifest

    expect(() =>
      createSeethingSwarmAnimalRegistry(manifests.slice(0, -1)),
    ).toThrow("Invalid SeethingSwarm registry animal count")
    expect(() =>
      createSeethingSwarmAnimalRegistry([
        ...manifests.slice(0, -1),
        manifests[0]!,
      ]),
    ).toThrow("Invalid SeethingSwarm registry animal at position 44")
    expect(() =>
      createSeethingSwarmAnimalRegistry(
        replaceManifest(manifests, 0, unknownAnimalManifest),
      ),
    ).toThrow("Invalid SeethingSwarm registry animal at position 0")
    expect(() =>
      createSeethingSwarmAnimalRegistry([
        manifests[1]!,
        manifests[0]!,
        ...manifests.slice(2),
      ]),
    ).toThrow("Invalid SeethingSwarm registry animal at position 0")
  })

  it("rejects a manifest from a mismatched evidence snapshot", () => {
    const manifests = createCompleteTestManifests()
    const mismatchedManifest = createTestManifest(0, {
      evidenceSnapshotId: "seethingswarm-animals:altered",
    })

    expect(() =>
      createSeethingSwarmAnimalRegistry(
        replaceManifest(manifests, 0, mismatchedManifest),
      ),
    ).toThrow("Invalid SeethingSwarm evidence snapshot for bat")
  })

  it("rejects mismatched character-animation and auxiliary-effect totals", () => {
    const manifests = createCompleteTestManifests()
    const incompleteAnimationManifest = createTestManifest(0, {
      animationCount: 25,
    })
    const missingEffectManifest = createTestManifest(frogpackAnimalIndex, {
      auxiliaryEffectCount: 0,
    })

    expect(() =>
      createSeethingSwarmAnimalRegistry(
        replaceManifest(manifests, 0, incompleteAnimationManifest),
      ),
    ).toThrow("Invalid SeethingSwarm character animation count: 773")
    expect(() =>
      createSeethingSwarmAnimalRegistry(
        replaceManifest(manifests, frogpackAnimalIndex, missingEffectManifest),
      ),
    ).toThrow("Invalid SeethingSwarm auxiliary effect count: 0")
  })
})
