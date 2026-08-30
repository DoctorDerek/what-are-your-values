import {
  createSeethingSwarmAnimalManifest,
  type SeethingSwarmAnimalManifest,
} from "#game/data/src/SeethingSwarmAnimalManifest"
import { createSeethingSwarmAnimalRegistry } from "#game/data/src/SeethingSwarmAnimalRegistry"
import {
  SEETHING_SWARM_SOURCE_PACKS,
  SEETHING_SWARM_SOURCE_SNAPSHOT,
  type SeethingSwarmSourcePack,
} from "#game/data/src/SeethingSwarmSourceEvidence"
import { ZOO_ANIMALS, type ZooAnimalId } from "#game/data/src/ZooAnimals"
import type {
  SeethingSwarmValidatedAnimation,
  SeethingSwarmValidatedSnapshot,
} from "./SeethingSwarmSnapshotValidator"

function compareAnimationRecords(
  first: SeethingSwarmValidatedAnimation,
  second: SeethingSwarmValidatedAnimation,
) {
  return (
    compareText(first.animationId, second.animationId) ||
    compareText(first.relativePath, second.relativePath)
  )
}

function compareText(first: string, second: string) {
  if (first < second) return -1
  if (first > second) return 1
  return 0
}

function isWithinSourcePath(relativePath: string, sourceRelativePath: string) {
  return relativePath.startsWith(`${sourceRelativePath}/`)
}

function getFamilyId(sourcePack: SeethingSwarmSourcePack) {
  const familyId = sourcePack.sourceDirectory.replace(/_spritesheets$/, "")
  if (familyId === sourcePack.sourceDirectory) {
    throw new Error(
      `Invalid SeethingSwarm source directory: ${sourcePack.sourceDirectory}`,
    )
  }

  return familyId
}

function getAnimalSourceRelativePath(
  sourcePack: SeethingSwarmSourcePack,
  animalId: ZooAnimalId,
) {
  if (sourcePack.animalIds.length === 1) return sourcePack.sourceDirectory

  const variantId = animalId.split("/").at(-1)!
  return `${sourcePack.sourceDirectory}/${variantId}_spritesheets`
}

function getAnimalPalette(
  snapshot: SeethingSwarmValidatedSnapshot,
  sourcePack: SeethingSwarmSourcePack,
  animalId: ZooAnimalId,
) {
  const sourceRelativePath = getAnimalSourceRelativePath(sourcePack, animalId)
  const palette = snapshot.paletteEvidence.find(
    (candidate) => candidate.sourceRelativePath === sourceRelativePath,
  )
  if (!palette) {
    throw new Error(
      `Missing SeethingSwarm palette evidence for ${animalId}: ${sourceRelativePath}`,
    )
  }

  return palette
}

function getAnimalAnimations(
  animations: readonly SeethingSwarmValidatedAnimation[],
  sourceRelativePath: string,
  animalId: ZooAnimalId,
) {
  const matchingAnimations = animations
    .filter(({ relativePath }) =>
      isWithinSourcePath(relativePath, sourceRelativePath),
    )
    .toSorted(compareAnimationRecords)
  if (matchingAnimations.length === 0) {
    throw new Error(`Missing SeethingSwarm character animations: ${animalId}`)
  }

  return matchingAnimations
}

function assertConsistentCharacterGeometry(
  animations: readonly SeethingSwarmValidatedAnimation[],
  animalId: ZooAnimalId,
) {
  const firstAnimation = animations[0]!
  if (
    animations.some(
      ({ frameWidth, frameHeight }) =>
        frameWidth !== firstAnimation.frameWidth ||
        frameHeight !== firstAnimation.frameHeight,
    )
  ) {
    throw new Error(`Conflicting SeethingSwarm character geometry: ${animalId}`)
  }

  return Object.freeze({
    frameWidth: firstAnimation.frameWidth,
    frameHeight: firstAnimation.frameHeight,
  })
}

function createAnimalManifest(
  snapshot: SeethingSwarmValidatedSnapshot,
  sourcePack: SeethingSwarmSourcePack,
  animalId: ZooAnimalId,
) {
  const palette = getAnimalPalette(snapshot, sourcePack, animalId)
  const animations = getAnimalAnimations(
    snapshot.characterAnimations,
    palette.sourceRelativePath,
    animalId,
  )
  const auxiliaryEffects = snapshot.auxiliaryEffects
    .filter(({ relativePath }) =>
      isWithinSourcePath(relativePath, palette.sourceRelativePath),
    )
    .toSorted(compareAnimationRecords)
  const characterGeometry = assertConsistentCharacterGeometry(
    animations,
    animalId,
  )

  return createSeethingSwarmAnimalManifest({
    animalId,
    familyId: getFamilyId(sourcePack),
    sourceRelativePath: palette.sourceRelativePath,
    sourceColorLabel: palette.colorLabel,
    ...characterGeometry,
    animations: Object.freeze(
      animations.map(({ animationId, relativePath, frameCount }) =>
        Object.freeze({ animationId, relativePath, frameCount }),
      ),
    ),
    ...(auxiliaryEffects.length > 0
      ? {
          auxiliaryEffects: Object.freeze(
            auxiliaryEffects.map(
              ({
                animationId,
                relativePath,
                frameWidth,
                frameHeight,
                frameCount,
              }) =>
                Object.freeze({
                  effectId: animationId,
                  relativePath,
                  frameWidth,
                  frameHeight,
                  frameCount,
                }),
            ),
          ),
        }
      : {}),
    evidenceSnapshotId: snapshot.evidenceSnapshotId,
  })
}

function createAnimalManifestMap(snapshot: SeethingSwarmValidatedSnapshot) {
  const animalManifestMap = new Map<ZooAnimalId, SeethingSwarmAnimalManifest>()
  const usedPalettePaths = new Set<string>()

  for (const sourcePack of SEETHING_SWARM_SOURCE_PACKS) {
    if (sourcePack.sourceSnapshotId !== snapshot.evidenceSnapshotId) {
      throw new Error(
        `Mismatched SeethingSwarm source snapshot: ${sourcePack.packId}`,
      )
    }

    for (const animalId of sourcePack.animalIds) {
      const manifest = createAnimalManifest(snapshot, sourcePack, animalId)
      if (animalManifestMap.has(animalId)) {
        throw new Error(`Duplicate SeethingSwarm animal ownership: ${animalId}`)
      }
      if (usedPalettePaths.has(manifest.sourceRelativePath)) {
        throw new Error(
          `Duplicate SeethingSwarm animal palette path: ${manifest.sourceRelativePath}`,
        )
      }

      animalManifestMap.set(animalId, manifest)
      usedPalettePaths.add(manifest.sourceRelativePath)
    }
  }

  const animalSourceDirectories = new Set(
    SEETHING_SWARM_SOURCE_PACKS.map(({ sourceDirectory }) => sourceDirectory),
  )
  const animalPalettePaths = snapshot.paletteEvidence
    .filter(({ sourceRelativePath }) =>
      animalSourceDirectories.has(sourceRelativePath.split("/")[0]!),
    )
    .map(({ sourceRelativePath }) => sourceRelativePath)
  const unusedPalettePath = animalPalettePaths.find(
    (sourceRelativePath) => !usedPalettePaths.has(sourceRelativePath),
  )
  if (
    unusedPalettePath ||
    animalPalettePaths.length !== usedPalettePaths.size
  ) {
    throw new Error(
      `Unmatched SeethingSwarm animal palette path: ${unusedPalettePath ?? "missing"}`,
    )
  }

  return animalManifestMap
}

export function serializeSeethingSwarmAnimalRegistry(
  registry: ReturnType<typeof createSeethingSwarmAnimalRegistry>,
) {
  return `${JSON.stringify(registry, null, 2)}\n`
}

export function generateSeethingSwarmAnimalRegistry(
  snapshot: SeethingSwarmValidatedSnapshot,
) {
  if (
    snapshot.evidenceSnapshotId !==
    SEETHING_SWARM_SOURCE_SNAPSHOT.sourceSnapshotId
  ) {
    throw new Error(
      `Invalid SeethingSwarm generator snapshot: ${snapshot.evidenceSnapshotId}`,
    )
  }

  const animalManifestMap = createAnimalManifestMap(snapshot)
  const registry = createSeethingSwarmAnimalRegistry(
    ZOO_ANIMALS.map(({ id }) => {
      const manifest = animalManifestMap.get(id)
      if (!manifest) throw new Error(`Missing SeethingSwarm animal: ${id}`)
      return manifest
    }),
  )

  return Object.freeze({
    registry,
    serializedRegistry: serializeSeethingSwarmAnimalRegistry(registry),
  })
}
