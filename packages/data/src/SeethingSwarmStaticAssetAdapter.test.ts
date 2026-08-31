import { describe, expect, it } from "vitest"
import type {
  SeethingSwarmAnimalRegistry,
  SeethingSwarmPublicFallbackRegistry,
} from "./SeethingSwarmAnimalRegistry"
import { SEETHING_SWARM_PLACEHOLDER_REGISTRY } from "./SeethingSwarmPlaceholderRegistry"
import {
  createSeethingSwarmLicensedStaticAssetAdapter,
  createSeethingSwarmTypographyOnlyStaticAssetAdapter,
  SEETHING_SWARM_STATIC_ASSET_MODES,
  type SeethingSwarmStaticAssetAdapter,
  type SeethingSwarmStaticAssetSource,
} from "./SeethingSwarmStaticAssetAdapter"

const testRegistry = Object.freeze({
  evidenceSnapshotId: "seethingswarm-test-snapshot",
  animals: Object.freeze([
    Object.freeze({
      animalId: "bat",
      familyId: "batpack",
      sourceRelativePath: "batpack_spritesheets",
      sourceColorLabel: "gray",
      frameWidth: 32,
      frameHeight: 32,
      animations: Object.freeze({
        idle: Object.freeze({
          relativePath: "batpack_spritesheets/bat_idle_strip4.png",
          frameCount: 4,
        }),
        run: Object.freeze({
          relativePath: "batpack_spritesheets/bat_run_strip6.png",
          frameCount: 6,
        }),
      }),
      auxiliaryEffects: Object.freeze({
        sparkle: Object.freeze({
          relativePath: "batpack_spritesheets/sparkle_strip2.png",
          frameWidth: 8,
          frameHeight: 8,
          frameCount: 2,
        }),
      }),
      evidenceSnapshotId: "seethingswarm-test-snapshot",
    }),
  ]),
  characterAnimationCount: 2,
  auxiliaryEffectCount: 1,
}) satisfies SeethingSwarmAnimalRegistry

type TestPlatformAsset = Readonly<{ uri: string }>

const licensedSources: readonly SeethingSwarmStaticAssetSource<TestPlatformAsset>[] =
  Object.freeze([
    Object.freeze({
      relativePath: "batpack_spritesheets/bat_idle_strip4.png",
      asset: Object.freeze({ uri: "idle" }),
    }),
    Object.freeze({
      relativePath: "batpack_spritesheets/bat_run_strip6.png",
      asset: Object.freeze({ uri: "run" }),
    }),
    Object.freeze({
      relativePath: "batpack_spritesheets/sparkle_strip2.png",
      asset: Object.freeze({ uri: "sparkle" }),
    }),
  ])

function readAdapterMode<PlatformAsset>(
  adapter: SeethingSwarmStaticAssetAdapter<PlatformAsset>,
) {
  return adapter.mode
}

describe("SeethingSwarm static asset adapter", () => {
  it("defines the complete immutable source-mode vocabulary", () => {
    expect(SEETHING_SWARM_STATIC_ASSET_MODES).toEqual([
      "licensed",
      "typography-only",
    ])
    expect(Object.isFrozen(SEETHING_SWARM_STATIC_ASSET_MODES)).toBe(true)
  })

  it("creates a deeply frozen licensed adapter in registry path order", () => {
    const adapter =
      createSeethingSwarmLicensedStaticAssetAdapter<TestPlatformAsset>(
        testRegistry,
        licensedSources,
      )

    expect(readAdapterMode(adapter)).toBe("licensed")
    expect(adapter).toEqual({
      mode: "licensed",
      evidenceSnapshotId: "seethingswarm-test-snapshot",
      sources: licensedSources,
    })
    expect(Object.isFrozen(adapter)).toBe(true)
    expect(Object.isFrozen(adapter.sources)).toBe(true)
    expect(adapter.sources.every(Object.isFrozen)).toBe(true)
  })

  it("rejects incomplete mismatched and out-of-order licensed sources", () => {
    expect(() =>
      createSeethingSwarmLicensedStaticAssetAdapter<TestPlatformAsset>(
        testRegistry,
        licensedSources.slice(0, -1),
      ),
    ).toThrow(
      "Invalid SeethingSwarm licensed source count: expected 3, received 2",
    )
    expect(() =>
      createSeethingSwarmLicensedStaticAssetAdapter<TestPlatformAsset>(
        testRegistry,
        [
          Object.freeze({
            relativePath: "batpack_spritesheets/unexpected.png",
            asset: Object.freeze({ uri: "unexpected" }),
          }),
          ...licensedSources.slice(1),
        ],
      ),
    ).toThrow("Invalid SeethingSwarm licensed source at position 0")
    expect(() =>
      createSeethingSwarmLicensedStaticAssetAdapter<TestPlatformAsset>(
        testRegistry,
        [licensedSources[1]!, licensedSources[0]!, licensedSources[2]!],
      ),
    ).toThrow("Invalid SeethingSwarm licensed source at position 0")
  })

  it.each([null, undefined])(
    "rejects a licensed path without a platform asset handle: %s",
    (asset) => {
      expect(() =>
        createSeethingSwarmLicensedStaticAssetAdapter<
          TestPlatformAsset | null | undefined
        >(testRegistry, [
          { ...licensedSources[0]!, asset },
          licensedSources[1]!,
          licensedSources[2]!,
        ]),
      ).toThrow(
        "Missing SeethingSwarm licensed asset: batpack_spritesheets/bat_idle_strip4.png",
      )
    },
  )

  it("creates a deeply frozen typography-only adapter from public metadata", () => {
    const adapter = createSeethingSwarmTypographyOnlyStaticAssetAdapter()

    expect(readAdapterMode(adapter)).toBe("typography-only")
    expect(adapter).toEqual({
      mode: "typography-only",
      animals: SEETHING_SWARM_PLACEHOLDER_REGISTRY.animals,
    })
    expect(Object.isFrozen(adapter)).toBe(true)
    expect(Object.isFrozen(adapter.animals)).toBe(true)
    expect(adapter.animals.every(Object.isFrozen)).toBe(true)
  })

  it("rejects incomplete or reordered typography-only animal identities", () => {
    expect(() =>
      createSeethingSwarmTypographyOnlyStaticAssetAdapter({
        animals: SEETHING_SWARM_PLACEHOLDER_REGISTRY.animals.slice(0, -1),
      }),
    ).toThrow("Invalid SeethingSwarm typography-only animal count: 44")

    const reorderedAnimals = [
      SEETHING_SWARM_PLACEHOLDER_REGISTRY.animals[1]!,
      SEETHING_SWARM_PLACEHOLDER_REGISTRY.animals[0]!,
      ...SEETHING_SWARM_PLACEHOLDER_REGISTRY.animals.slice(2),
    ]
    expect(() =>
      createSeethingSwarmTypographyOnlyStaticAssetAdapter({
        animals: reorderedAnimals,
      }),
    ).toThrow("Invalid SeethingSwarm typography-only animal at position 0")
  })

  it("rejects invented typography-only placeholders and licensed metadata", () => {
    const inventedPlaceholderRegistry = {
      animals: SEETHING_SWARM_PLACEHOLDER_REGISTRY.animals.map(
        (animal, index) =>
          index === 0
            ? { ...animal, placeholderId: "licensed-bat-sprite" }
            : animal,
      ),
    } satisfies SeethingSwarmPublicFallbackRegistry
    expect(() =>
      createSeethingSwarmTypographyOnlyStaticAssetAdapter(
        inventedPlaceholderRegistry,
      ),
    ).toThrow("Invalid SeethingSwarm typography-only placeholder for bat")

    const inventedLicensedMetadataRegistry = {
      animals: SEETHING_SWARM_PLACEHOLDER_REGISTRY.animals.map(
        (animal, index) =>
          index === 0 ? { ...animal, licensedPath: "bat.png" } : animal,
      ),
    } as unknown as SeethingSwarmPublicFallbackRegistry
    expect(() =>
      createSeethingSwarmTypographyOnlyStaticAssetAdapter(
        inventedLicensedMetadataRegistry,
      ),
    ).toThrow("Invalid SeethingSwarm typography-only metadata for bat")
  })
})
