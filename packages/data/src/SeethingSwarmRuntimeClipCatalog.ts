import type { SeethingSwarmAnimalManifest } from "./SeethingSwarmAnimalManifest"
import type {
  SeethingSwarmAnimalRegistry,
  SeethingSwarmPublicFallbackRegistry,
} from "./SeethingSwarmAnimalRegistry"
import {
  createSeethingSwarmLicensedStaticAssetAdapter,
  createSeethingSwarmTypographyOnlyStaticAssetAdapter,
} from "./SeethingSwarmStaticAssetAdapter"
import type { ZooAnimalId } from "./ZooAnimals"

export type SeethingSwarmVisibleContentBounds = Readonly<{
  left: number
  top: number
  width: number
  height: number
}>

export type SeethingSwarmRuntimeAssetSource<PlatformAsset> = Readonly<{
  relativePath: string
  visibleBounds: SeethingSwarmVisibleContentBounds
  asset: PlatformAsset
}>

export type SeethingSwarmRuntimeCharacterClip<PlatformAsset> = Readonly<{
  kind: "character"
  animalId: ZooAnimalId
  animationId: string
  relativePath: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  visibleBounds: SeethingSwarmVisibleContentBounds
  asset: PlatformAsset
}>

export type SeethingSwarmRuntimeAuxiliaryEffectClip<PlatformAsset> = Readonly<{
  kind: "auxiliary-effect"
  animalId: ZooAnimalId
  effectId: string
  relativePath: string
  frameWidth: number
  frameHeight: number
  frameCount: number
  visibleBounds: SeethingSwarmVisibleContentBounds
  asset: PlatformAsset
}>

export type SeethingSwarmRuntimeAnimalClips<PlatformAsset> = Readonly<{
  animalId: ZooAnimalId
  characterClips: readonly SeethingSwarmRuntimeCharacterClip<PlatformAsset>[]
  auxiliaryEffectClips: readonly SeethingSwarmRuntimeAuxiliaryEffectClip<PlatformAsset>[]
}>

export type SeethingSwarmLicensedRuntimeClipCatalog<PlatformAsset> = Readonly<{
  mode: "licensed"
  evidenceSnapshotId: string
  animals: readonly SeethingSwarmRuntimeAnimalClips<PlatformAsset>[]
  characterClipCount: number
  auxiliaryEffectClipCount: number
}>

export type SeethingSwarmTypographyOnlyRuntimeClipCatalog = Readonly<{
  mode: "typography-only"
}>

export type SeethingSwarmRuntimeClipCatalog<PlatformAsset> =
  | SeethingSwarmLicensedRuntimeClipCatalog<PlatformAsset>
  | SeethingSwarmTypographyOnlyRuntimeClipCatalog

function compareText(first: string, second: string) {
  if (first < second) return -1
  if (first > second) return 1
  return 0
}

function assertNonNegativeSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

function assertPositiveSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

export function createSeethingSwarmVisibleContentBounds(
  frameWidth: number,
  frameHeight: number,
  bounds: SeethingSwarmVisibleContentBounds,
) {
  assertNonNegativeSafeInteger(bounds.left, "visible-content left edge")
  assertNonNegativeSafeInteger(bounds.top, "visible-content top edge")
  assertPositiveSafeInteger(bounds.width, "visible-content width")
  assertPositiveSafeInteger(bounds.height, "visible-content height")

  if (
    bounds.left + bounds.width > frameWidth ||
    bounds.top + bounds.height > frameHeight
  ) {
    throw new Error(
      `Visible SeethingSwarm content exceeds its ${frameWidth}x${frameHeight} frame`,
    )
  }

  return Object.freeze({ ...bounds })
}

function createRuntimeAssetSourceMap<PlatformAsset>(
  registry: SeethingSwarmAnimalRegistry,
  sources: readonly SeethingSwarmRuntimeAssetSource<PlatformAsset>[],
) {
  createSeethingSwarmLicensedStaticAssetAdapter(
    registry,
    sources.map(({ relativePath, asset }) =>
      Object.freeze({ relativePath, asset }),
    ),
  )

  return new Map(sources.map((source) => [source.relativePath, source]))
}

function resolveRuntimeAssetSource<PlatformAsset>(
  sources: ReadonlyMap<string, SeethingSwarmRuntimeAssetSource<PlatformAsset>>,
  relativePath: string,
) {
  const source = sources.get(relativePath)
  if (!source) {
    throw new Error(`Missing SeethingSwarm runtime asset: ${relativePath}`)
  }
  return source
}

function createCharacterClips<PlatformAsset>(
  animal: SeethingSwarmAnimalManifest,
  sources: ReadonlyMap<string, SeethingSwarmRuntimeAssetSource<PlatformAsset>>,
) {
  return Object.freeze(
    Object.entries(animal.animations)
      .toSorted(([firstAnimationId], [secondAnimationId]) =>
        compareText(firstAnimationId, secondAnimationId),
      )
      .map(([animationId, animation]) => {
        const source = resolveRuntimeAssetSource(
          sources,
          animation.relativePath,
        )
        return Object.freeze({
          kind: "character",
          animalId: animal.animalId,
          animationId,
          relativePath: animation.relativePath,
          frameWidth: animal.frameWidth,
          frameHeight: animal.frameHeight,
          frameCount: animation.frameCount,
          visibleBounds: createSeethingSwarmVisibleContentBounds(
            animal.frameWidth,
            animal.frameHeight,
            source.visibleBounds,
          ),
          asset: source.asset,
        }) satisfies SeethingSwarmRuntimeCharacterClip<PlatformAsset>
      }),
  )
}

function createAuxiliaryEffectClips<PlatformAsset>(
  animal: SeethingSwarmAnimalManifest,
  sources: ReadonlyMap<string, SeethingSwarmRuntimeAssetSource<PlatformAsset>>,
) {
  return Object.freeze(
    Object.entries(animal.auxiliaryEffects ?? {})
      .toSorted(([firstEffectId], [secondEffectId]) =>
        compareText(firstEffectId, secondEffectId),
      )
      .map(([effectId, effect]) => {
        const source = resolveRuntimeAssetSource(sources, effect.relativePath)
        return Object.freeze({
          kind: "auxiliary-effect",
          animalId: animal.animalId,
          effectId,
          relativePath: effect.relativePath,
          frameWidth: effect.frameWidth,
          frameHeight: effect.frameHeight,
          frameCount: effect.frameCount,
          visibleBounds: createSeethingSwarmVisibleContentBounds(
            effect.frameWidth,
            effect.frameHeight,
            source.visibleBounds,
          ),
          asset: source.asset,
        }) satisfies SeethingSwarmRuntimeAuxiliaryEffectClip<PlatformAsset>
      }),
  )
}

export function createSeethingSwarmLicensedRuntimeClipCatalog<PlatformAsset>(
  registry: SeethingSwarmAnimalRegistry,
  sources: readonly SeethingSwarmRuntimeAssetSource<PlatformAsset>[],
) {
  const sourcesByRelativePath = createRuntimeAssetSourceMap(registry, sources)
  const animals = Object.freeze(
    registry.animals.map((animal) =>
      Object.freeze({
        animalId: animal.animalId,
        characterClips: createCharacterClips(animal, sourcesByRelativePath),
        auxiliaryEffectClips: createAuxiliaryEffectClips(
          animal,
          sourcesByRelativePath,
        ),
      }),
    ),
  )
  const characterClipCount = animals.reduce(
    (count, animal) => count + animal.characterClips.length,
    0,
  )
  const auxiliaryEffectClipCount = animals.reduce(
    (count, animal) => count + animal.auxiliaryEffectClips.length,
    0,
  )

  if (characterClipCount !== registry.characterAnimationCount) {
    throw new Error(
      `Invalid SeethingSwarm runtime character clip count: expected ${registry.characterAnimationCount}, received ${characterClipCount}`,
    )
  }
  if (auxiliaryEffectClipCount !== registry.auxiliaryEffectCount) {
    throw new Error(
      `Invalid SeethingSwarm runtime auxiliary effect count: expected ${registry.auxiliaryEffectCount}, received ${auxiliaryEffectClipCount}`,
    )
  }

  return Object.freeze({
    mode: "licensed",
    evidenceSnapshotId: registry.evidenceSnapshotId,
    animals,
    characterClipCount,
    auxiliaryEffectClipCount,
  }) satisfies SeethingSwarmLicensedRuntimeClipCatalog<PlatformAsset>
}

export function createSeethingSwarmTypographyOnlyRuntimeClipCatalog(
  registry?: SeethingSwarmPublicFallbackRegistry,
) {
  createSeethingSwarmTypographyOnlyStaticAssetAdapter(registry)
  return Object.freeze({
    mode: "typography-only",
  }) satisfies SeethingSwarmTypographyOnlyRuntimeClipCatalog
}

function resolveRuntimeAnimalClips<PlatformAsset>(
  catalog: SeethingSwarmLicensedRuntimeClipCatalog<PlatformAsset>,
  animalId: ZooAnimalId,
) {
  const animal = catalog.animals.find(
    (candidate) => candidate.animalId === animalId,
  )
  if (!animal) {
    throw new Error(`Missing SeethingSwarm runtime animal: ${animalId}`)
  }
  return animal
}

export function resolveSeethingSwarmRuntimeCharacterClip<PlatformAsset>(
  catalog: SeethingSwarmLicensedRuntimeClipCatalog<PlatformAsset>,
  animalId: ZooAnimalId,
  animationId: string,
) {
  const clip = resolveRuntimeAnimalClips(catalog, animalId).characterClips.find(
    (candidate) => candidate.animationId === animationId,
  )
  if (!clip) {
    throw new Error(
      `Missing SeethingSwarm runtime character clip: ${animalId}/${animationId}`,
    )
  }
  return clip
}

export function resolveSeethingSwarmRuntimeAuxiliaryEffectClip<PlatformAsset>(
  catalog: SeethingSwarmLicensedRuntimeClipCatalog<PlatformAsset>,
  animalId: ZooAnimalId,
  effectId: string,
) {
  const clip = resolveRuntimeAnimalClips(
    catalog,
    animalId,
  ).auxiliaryEffectClips.find((candidate) => candidate.effectId === effectId)
  if (!clip) {
    throw new Error(
      `Missing SeethingSwarm runtime auxiliary effect: ${animalId}/${effectId}`,
    )
  }
  return clip
}
