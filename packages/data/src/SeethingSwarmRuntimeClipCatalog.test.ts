import { describe, expect, it } from "vitest"
import {
  createSeethingSwarmAnimalManifest,
  type SeethingSwarmAnimalManifestInput,
} from "./SeethingSwarmAnimalManifest"
import { createSeethingSwarmAnimalRegistry } from "./SeethingSwarmAnimalRegistry"
import {
  createSeethingSwarmLicensedRuntimeClipCatalog,
  createSeethingSwarmTypographyOnlyRuntimeClipCatalog,
  createSeethingSwarmVisibleContentBounds,
  resolveSeethingSwarmRuntimeAuxiliaryEffectClip,
  resolveSeethingSwarmRuntimeCharacterClip,
  type SeethingSwarmRuntimeAssetSource,
} from "./SeethingSwarmRuntimeClipCatalog"
import { SEETHING_SWARM_SOURCE_SNAPSHOT } from "./SeethingSwarmSourceEvidence"
import { ZOO_ANIMALS } from "./ZooAnimals"

const frogpackAnimalIndex = ZOO_ANIMALS.findIndex(({ id }) => id === "frogpack")

function createCompleteTestRegistry() {
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
          Array.from({ length: animationCount }, (_, animationIndex) =>
            Object.freeze({
              animationId: `animation_${animationIndex}`,
              relativePath: `${sourceRelativePath}/animation_${animationIndex}.png`,
              frameCount: (animationIndex % 8) + 1,
            }),
          ),
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

function createRuntimeAssetSources(registry = createCompleteTestRegistry()) {
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

function createCompleteTestCatalog() {
  const registry = createCompleteTestRegistry()
  return Object.freeze({
    registry,
    catalog: createSeethingSwarmLicensedRuntimeClipCatalog(
      registry,
      createRuntimeAssetSources(registry),
    ),
  })
}

describe("SeethingSwarm runtime clip catalog", () => {
  it("resolves all 774 canonical character clips and the Frog effect", () => {
    const { registry, catalog } = createCompleteTestCatalog()
    const resolvedCharacterClips = registry.animals.flatMap((animal) =>
      Object.keys(animal.animations).map((animationId) =>
        resolveSeethingSwarmRuntimeCharacterClip(
          catalog,
          animal.animalId,
          animationId,
        ),
      ),
    )
    const frogEffect = resolveSeethingSwarmRuntimeAuxiliaryEffectClip(
      catalog,
      "frogpack",
      "fly",
    )

    expect(catalog.mode).toBe("licensed")
    expect(catalog.evidenceSnapshotId).toBe(registry.evidenceSnapshotId)
    expect(catalog.animals).toHaveLength(45)
    expect(catalog.characterClipCount).toBe(774)
    expect(catalog.auxiliaryEffectClipCount).toBe(1)
    expect(resolvedCharacterClips).toHaveLength(774)
    expect(
      new Set(
        resolvedCharacterClips.map(
          ({ animalId, animationId }) => `${animalId}:${animationId}`,
        ),
      ).size,
    ).toBe(774)
    expect(frogEffect).toMatchObject({
      kind: "auxiliary-effect",
      animalId: "frogpack",
      effectId: "fly",
      frameWidth: 8,
      frameHeight: 6,
      frameCount: 2,
    })
  })

  it("deeply freezes every level of catalog metadata", () => {
    const { catalog } = createCompleteTestCatalog()
    const characterClips = catalog.animals.flatMap(
      ({ characterClips }) => characterClips,
    )
    const auxiliaryEffectClips = catalog.animals.flatMap(
      ({ auxiliaryEffectClips }) => auxiliaryEffectClips,
    )

    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.isFrozen(catalog.animals)).toBe(true)
    expect(catalog.animals.every(Object.isFrozen)).toBe(true)
    expect(
      catalog.animals.every(
        ({ characterClips, auxiliaryEffectClips }) =>
          Object.isFrozen(characterClips) &&
          Object.isFrozen(auxiliaryEffectClips),
      ),
    ).toBe(true)
    expect(characterClips.every(Object.isFrozen)).toBe(true)
    expect(auxiliaryEffectClips.every(Object.isFrozen)).toBe(true)
    expect(
      [...characterClips, ...auxiliaryEffectClips].every(({ visibleBounds }) =>
        Object.isFrozen(visibleBounds),
      ),
    ).toBe(true)
  })

  it("keeps character and auxiliary identities in disjoint lookup domains", () => {
    const { catalog } = createCompleteTestCatalog()

    expect(() =>
      resolveSeethingSwarmRuntimeCharacterClip(catalog, "frogpack", "fly"),
    ).toThrow("Missing SeethingSwarm runtime character clip: frogpack/fly")
    expect(() =>
      resolveSeethingSwarmRuntimeAuxiliaryEffectClip(
        catalog,
        "frogpack",
        "animation_0",
      ),
    ).toThrow(
      "Missing SeethingSwarm runtime auxiliary effect: frogpack/animation_0",
    )
    expect(() =>
      resolveSeethingSwarmRuntimeCharacterClip(
        catalog,
        "bat",
        "missing_animation",
      ),
    ).toThrow(
      "Missing SeethingSwarm runtime character clip: bat/missing_animation",
    )
    expect(() =>
      resolveSeethingSwarmRuntimeCharacterClip(
        catalog,
        "wolfpack",
        "animation_99",
      ),
    ).toThrow(
      "Missing SeethingSwarm runtime character clip: wolfpack/animation_99",
    )
  })

  it("rejects incomplete unordered nullish and geometrically invalid sources", () => {
    const registry = createCompleteTestRegistry()
    const sources = createRuntimeAssetSources(registry)

    expect(() =>
      createSeethingSwarmLicensedRuntimeClipCatalog(
        registry,
        sources.slice(0, -1),
      ),
    ).toThrow("Invalid SeethingSwarm licensed source count")
    expect(() =>
      createSeethingSwarmLicensedRuntimeClipCatalog(registry, [
        sources[1]!,
        sources[0]!,
        ...sources.slice(2),
      ]),
    ).toThrow("Invalid SeethingSwarm licensed source at position 0")
    expect(() =>
      createSeethingSwarmLicensedRuntimeClipCatalog(registry, [
        { ...sources[0]!, asset: null },
        ...sources.slice(1),
      ]),
    ).toThrow("Missing SeethingSwarm licensed asset")
    expect(() =>
      createSeethingSwarmLicensedRuntimeClipCatalog(registry, [
        {
          ...sources[0]!,
          visibleBounds: { left: 31, top: 0, width: 2, height: 1 },
        },
        ...sources.slice(1),
      ]),
    ).toThrow("Visible SeethingSwarm content exceeds its 32x32 frame")
  })

  it("rejects registry totals that disagree with the resolved catalog", () => {
    const registry = createCompleteTestRegistry()
    const sources = createRuntimeAssetSources(registry)

    expect(() =>
      createSeethingSwarmLicensedRuntimeClipCatalog(
        { ...registry, characterAnimationCount: 773 },
        sources,
      ),
    ).toThrow(
      "Invalid SeethingSwarm runtime character clip count: expected 773, received 774",
    )
    expect(() =>
      createSeethingSwarmLicensedRuntimeClipCatalog(
        { ...registry, auxiliaryEffectCount: 0 },
        sources,
      ),
    ).toThrow(
      "Invalid SeethingSwarm runtime auxiliary effect count: expected 0, received 1",
    )
  })

  it.each([
    [{ left: -1, top: 0, width: 1, height: 1 }, "left edge"],
    [{ left: 0, top: -1, width: 1, height: 1 }, "top edge"],
    [{ left: 0, top: 0, width: 0, height: 1 }, "content width"],
    [{ left: 0, top: 0, width: 1, height: 0 }, "content height"],
  ] as const)(
    "rejects invalid visible bounds %#",
    (bounds, expectedMessage) => {
      expect(() =>
        createSeethingSwarmVisibleContentBounds(32, 32, bounds),
      ).toThrow(expectedMessage)
    },
  )

  it("creates one validated immutable typography-only catalog", () => {
    const catalog = createSeethingSwarmTypographyOnlyRuntimeClipCatalog()

    expect(catalog).toEqual({ mode: "typography-only" })
    expect(Object.isFrozen(catalog)).toBe(true)
  })
})
