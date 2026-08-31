import type {
  SeethingSwarmAnimalRegistry,
  SeethingSwarmPublicFallbackRegistry,
} from "./SeethingSwarmAnimalRegistry"
import {
  SEETHING_SWARM_PLACEHOLDER_REGISTRY,
  SEETHING_SWARM_PUBLIC_PLACEHOLDER_ID,
} from "./SeethingSwarmPlaceholderRegistry"
import { ZOO_ANIMALS } from "./ZooAnimals"

export const SEETHING_SWARM_STATIC_ASSET_MODES = Object.freeze([
  "licensed",
  "typography-only",
] as const)

export type SeethingSwarmStaticAssetMode =
  (typeof SEETHING_SWARM_STATIC_ASSET_MODES)[number]

export type SeethingSwarmStaticAssetSource<PlatformAsset> = Readonly<{
  relativePath: string
  asset: PlatformAsset
}>

export type SeethingSwarmLicensedStaticAssetAdapter<PlatformAsset> = Readonly<{
  mode: "licensed"
  evidenceSnapshotId: string
  sources: readonly SeethingSwarmStaticAssetSource<PlatformAsset>[]
}>

export type SeethingSwarmTypographyOnlyStaticAssetAdapter = Readonly<{
  mode: "typography-only"
  animals: SeethingSwarmPublicFallbackRegistry["animals"]
}>

export type SeethingSwarmStaticAssetAdapter<PlatformAsset> =
  | SeethingSwarmLicensedStaticAssetAdapter<PlatformAsset>
  | SeethingSwarmTypographyOnlyStaticAssetAdapter

function getRuntimeAssetPaths(registry: SeethingSwarmAnimalRegistry) {
  return registry.animals
    .flatMap(({ animations, auxiliaryEffects }) => [
      ...Object.values(animations).map(({ relativePath }) => relativePath),
      ...Object.values(auxiliaryEffects ?? {}).map(
        ({ relativePath }) => relativePath,
      ),
    ])
    .toSorted()
}

function assertLicensedSources<PlatformAsset>(
  registry: SeethingSwarmAnimalRegistry,
  sources: readonly SeethingSwarmStaticAssetSource<PlatformAsset>[],
) {
  const expectedPaths = getRuntimeAssetPaths(registry)
  if (sources.length !== expectedPaths.length) {
    throw new Error(
      `Invalid SeethingSwarm licensed source count: expected ${expectedPaths.length}, received ${sources.length}`,
    )
  }

  for (const [index, expectedPath] of expectedPaths.entries()) {
    const source = sources[index]
    if (source?.relativePath !== expectedPath) {
      throw new Error(
        `Invalid SeethingSwarm licensed source at position ${index}: expected ${expectedPath}, received ${source?.relativePath ?? "missing"}`,
      )
    }
    if (source.asset === null || source.asset === undefined) {
      throw new Error(`Missing SeethingSwarm licensed asset: ${expectedPath}`)
    }
  }
}

function assertTypographyOnlyAnimals(
  animals: SeethingSwarmPublicFallbackRegistry["animals"],
) {
  if (animals.length !== ZOO_ANIMALS.length) {
    throw new Error(
      `Invalid SeethingSwarm typography-only animal count: ${animals.length}`,
    )
  }

  for (const [index, expectedAnimal] of ZOO_ANIMALS.entries()) {
    const animal = animals[index]
    if (animal?.animalId !== expectedAnimal.id) {
      throw new Error(
        `Invalid SeethingSwarm typography-only animal at position ${index}: expected ${expectedAnimal.id}, received ${animal?.animalId ?? "missing"}`,
      )
    }
    if (animal.placeholderId !== SEETHING_SWARM_PUBLIC_PLACEHOLDER_ID) {
      throw new Error(
        `Invalid SeethingSwarm typography-only placeholder for ${animal.animalId}: ${animal.placeholderId}`,
      )
    }
    if (Object.keys(animal).toSorted().join(",") !== "animalId,placeholderId") {
      throw new Error(
        `Invalid SeethingSwarm typography-only metadata for ${animal.animalId}`,
      )
    }
  }
}

export function createSeethingSwarmLicensedStaticAssetAdapter<PlatformAsset>(
  registry: SeethingSwarmAnimalRegistry,
  sources: readonly SeethingSwarmStaticAssetSource<PlatformAsset>[],
) {
  assertLicensedSources(registry, sources)

  return Object.freeze({
    mode: "licensed",
    evidenceSnapshotId: registry.evidenceSnapshotId,
    sources: Object.freeze(
      sources.map(({ relativePath, asset }) =>
        Object.freeze({ relativePath, asset }),
      ),
    ),
  }) satisfies SeethingSwarmLicensedStaticAssetAdapter<PlatformAsset>
}

export function createSeethingSwarmTypographyOnlyStaticAssetAdapter(
  registry: SeethingSwarmPublicFallbackRegistry = SEETHING_SWARM_PLACEHOLDER_REGISTRY,
) {
  assertTypographyOnlyAnimals(registry.animals)

  return Object.freeze({
    mode: "typography-only",
    animals: Object.freeze(
      registry.animals.map(({ animalId, placeholderId }) =>
        Object.freeze({ animalId, placeholderId }),
      ),
    ),
  }) satisfies SeethingSwarmTypographyOnlyStaticAssetAdapter
}
