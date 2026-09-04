import {
  createSeethingSwarmAnimalManifest,
  type SeethingSwarmAnimalManifestInput,
} from "./SeethingSwarmAnimalManifest"
import { createSeethingSwarmAnimalRegistry } from "./SeethingSwarmAnimalRegistry"
import {
  createSeethingSwarmLicensedRuntimeClipCatalog,
  type SeethingSwarmRuntimeAssetSource,
} from "./SeethingSwarmRuntimeClipCatalog"
import { SEETHING_SWARM_SOURCE_SNAPSHOT } from "./SeethingSwarmSourceEvidence"
import { ZOO_ANIMALS } from "./ZooAnimals"

const frogpackAnimalIndex = ZOO_ANIMALS.findIndex(({ id }) => id === "frogpack")

export function createCompleteSeethingSwarmRuntimeClipTestRegistry() {
  return createSeethingSwarmAnimalRegistry(
    ZOO_ANIMALS.map(({ id }, animalIndex) => {
      const familyId = `animal_${animalIndex}`
      const sourceRelativePath = `${familyId}_spritesheets`
      const animationCount = animalIndex === 0 ? 26 : 17

      return createSeethingSwarmAnimalManifest({
        animalId: id,
        familyId,
        sourceRelativePath,
        sourceColorLabel: "neutral",
        frameWidth: 32,
        frameHeight: 32,
        animations: Object.freeze(
          Array.from({ length: animationCount }, (_, animationIndex) => {
            const animationId =
              animationIndex === 0
                ? id === "bat"
                  ? "idle_upright"
                  : "idle"
                : `animation_${animationIndex}`
            return Object.freeze({
              animationId,
              relativePath: `${sourceRelativePath}/${animationId}.png`,
              frameCount: (animationIndex % 8) + 1,
            })
          }),
        ),
        ...(animalIndex === frogpackAnimalIndex
          ? {
              auxiliaryEffects: Object.freeze([
                Object.freeze({
                  effectId: "fly",
                  relativePath: `${sourceRelativePath}/fly.png`,
                  frameWidth: 8,
                  frameHeight: 6,
                  frameCount: 2,
                }),
              ]),
            }
          : {}),
        evidenceSnapshotId: SEETHING_SWARM_SOURCE_SNAPSHOT.sourceSnapshotId,
      } satisfies SeethingSwarmAnimalManifestInput)
    }),
  )
}

export function createCompleteSeethingSwarmRuntimeClipTestSources(
  registry = createCompleteSeethingSwarmRuntimeClipTestRegistry(),
) {
  return Object.freeze(
    registry.animals
      .flatMap((animal) => [
        ...Object.values(animal.animations).map(({ relativePath }) =>
          Object.freeze({
            relativePath,
            visibleBounds: Object.freeze({
              left: 2,
              top: 3,
              width: 24,
              height: 25,
            }),
            asset: `asset:${relativePath}`,
          }),
        ),
        ...Object.values(animal.auxiliaryEffects ?? {}).map(
          ({ relativePath }) =>
            Object.freeze({
              relativePath,
              visibleBounds: Object.freeze({
                left: 1,
                top: 1,
                width: 6,
                height: 4,
              }),
              asset: `asset:${relativePath}`,
            }),
        ),
      ])
      .toSorted((first, second) => {
        if (first.relativePath < second.relativePath) return -1
        if (first.relativePath > second.relativePath) return 1
        return 0
      }),
  ) satisfies readonly SeethingSwarmRuntimeAssetSource<string>[]
}

export function createCompleteSeethingSwarmRuntimeClipTestFixture() {
  const registry = createCompleteSeethingSwarmRuntimeClipTestRegistry()
  const sources = createCompleteSeethingSwarmRuntimeClipTestSources(registry)
  return Object.freeze({
    registry,
    sources,
    catalog: createSeethingSwarmLicensedRuntimeClipCatalog(registry, sources),
  })
}
