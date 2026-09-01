import { describe, expect, it } from "vitest"
import { CANONICAL_VALUES } from "./CanonicalValues"
import {
  createSeethingSwarmAnimalPresentationGeometry,
  createSeethingSwarmLicensedAnimalPresentationAdapter,
  createSeethingSwarmTypographyOnlyAnimalPresentationAdapter,
  resolveValueAnimalPresentation,
  SEETHING_SWARM_HUB_ANIMATION_CANDIDATES,
  SEETHING_SWARM_HUB_FRAME_DURATION_MS,
  SEETHING_SWARM_HUB_TILE_SIZE,
  selectSeethingSwarmHubAnimations,
  type SeethingSwarmAnimalPresentation,
} from "./SeethingSwarmAnimalPresentation"
import type { SeethingSwarmAnimalRegistry } from "./SeethingSwarmAnimalRegistry"
import { createCanonicalValueId, createCustomValueId } from "./Value"
import { ZOO_ANIMALS } from "./ZooAnimals"

const testEvidenceSnapshotId = "seethingswarm-test-snapshot"

function createTestRegistry() {
  return Object.freeze({
    evidenceSnapshotId: testEvidenceSnapshotId,
    animals: Object.freeze(
      ZOO_ANIMALS.map(({ id }, index) => {
        const animationId = index === 0 ? "idle_upright" : "idle"
        return Object.freeze({
          animalId: id,
          familyId: `family_${index}`,
          sourceRelativePath: `family_${index}_spritesheets`,
          sourceColorLabel: "original",
          frameWidth: 32,
          frameHeight: 32,
          animations: Object.freeze({
            [animationId]: Object.freeze({
              relativePath: `family_${index}_spritesheets/${animationId}_strip4.png`,
              frameCount: 4,
            }),
          }),
          evidenceSnapshotId: testEvidenceSnapshotId,
        })
      }),
    ),
    characterAnimationCount: ZOO_ANIMALS.length,
    auxiliaryEffectCount: 0,
  }) satisfies SeethingSwarmAnimalRegistry
}

function createTestPresentations(
  registry: SeethingSwarmAnimalRegistry = createTestRegistry(),
) {
  const geometry = createSeethingSwarmAnimalPresentationGeometry(32, 32, {
    left: 2,
    top: 4,
    width: 20,
    height: 24,
  })

  return Object.freeze(
    selectSeethingSwarmHubAnimations(registry).map((selection) =>
      Object.freeze({
        ...selection,
        ...geometry,
        asset: `asset:${selection.animalId}`,
      }),
    ),
  ) satisfies readonly SeethingSwarmAnimalPresentation<string>[]
}

function replaceAt<Value>(
  values: readonly Value[],
  index: number,
  replacement: Value,
) {
  return values.map((value, valueIndex) =>
    valueIndex === index ? replacement : value,
  )
}

describe("SeethingSwarm animal presentation", () => {
  it("defines the immutable calm animation and fixed Hub geometry policy", () => {
    expect(SEETHING_SWARM_HUB_ANIMATION_CANDIDATES).toEqual([
      "idle",
      "idle_upright",
    ])
    expect(Object.isFrozen(SEETHING_SWARM_HUB_ANIMATION_CANDIDATES)).toBe(true)
    expect(SEETHING_SWARM_HUB_TILE_SIZE).toBe(72)
    expect(SEETHING_SWARM_HUB_FRAME_DURATION_MS).toBe(160)
  })

  it("resolves one calm strip for every animal in canonical order", () => {
    const selections = selectSeethingSwarmHubAnimations(createTestRegistry())

    expect(selections).toHaveLength(45)
    expect(selections.map(({ animalId }) => animalId)).toEqual(
      ZOO_ANIMALS.map(({ id }) => id),
    )
    expect(
      selections.filter(({ animationId }) => animationId === "idle"),
    ).toHaveLength(44)
    expect(selections[0]).toMatchObject({
      animalId: "bat",
      animationId: "idle_upright",
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 4,
    })
    expect(Object.isFrozen(selections)).toBe(true)
    expect(selections.every(Object.isFrozen)).toBe(true)
  })

  it("rejects missing reordered and animationless registry animals", () => {
    const registry = createTestRegistry()
    expect(() =>
      selectSeethingSwarmHubAnimations({
        ...registry,
        animals: registry.animals.slice(0, -1),
      }),
    ).toThrow("Invalid SeethingSwarm Hub animal count: 44")
    expect(() =>
      selectSeethingSwarmHubAnimations({
        ...registry,
        animals: [
          registry.animals[1]!,
          registry.animals[0]!,
          ...registry.animals.slice(2),
        ],
      }),
    ).toThrow("Invalid SeethingSwarm Hub animal at position 0")
    expect(() =>
      selectSeethingSwarmHubAnimations({
        ...registry,
        animals: Array.from({
          length: 45,
        }) as unknown as typeof registry.animals,
      }),
    ).toThrow(
      "Invalid SeethingSwarm Hub animal at position 0: expected bat, received missing",
    )

    const batWithoutCalmAnimation = Object.freeze({
      ...registry.animals[0]!,
      animations: Object.freeze({
        run: Object.freeze({
          relativePath: "bat_spritesheets/run_strip4.png",
          frameCount: 4,
        }),
      }),
    })
    expect(() =>
      selectSeethingSwarmHubAnimations({
        ...registry,
        animals: replaceAt(registry.animals, 0, batWithoutCalmAnimation),
      }),
    ).toThrow("Missing calm SeethingSwarm Hub animation for bat")
  })

  it("derives a frozen integer-scaled bottom-center geometry", () => {
    const geometry = createSeethingSwarmAnimalPresentationGeometry(32, 32, {
      left: 2,
      top: 4,
      width: 20,
      height: 24,
    })

    expect(geometry).toEqual({
      visibleBounds: { left: 2, top: 4, width: 20, height: 24 },
      integerScale: 3,
      frameOffsetX: 0,
      frameOffsetY: -12,
    })
    expect(Object.isFrozen(geometry)).toBe(true)
    expect(Object.isFrozen(geometry.visibleBounds)).toBe(true)
  })

  it.each([
    [0, 32, { left: 0, top: 0, width: 1, height: 1 }, "frame width"],
    [32, 0, { left: 0, top: 0, width: 1, height: 1 }, "frame height"],
    [32, 32, { left: -1, top: 0, width: 1, height: 1 }, "left edge"],
    [32, 32, { left: 0, top: -1, width: 1, height: 1 }, "top edge"],
    [32, 32, { left: 0, top: 0, width: 0, height: 1 }, "content width"],
    [32, 32, { left: 0, top: 0, width: 1, height: 0 }, "content height"],
    [32, 32, { left: 31, top: 0, width: 2, height: 1 }, "exceeds"],
    [32, 32, { left: 0, top: 31, width: 1, height: 2 }, "exceeds"],
    [80, 80, { left: 0, top: 0, width: 80, height: 80 }, "cannot fit"],
  ] as const)(
    "rejects invalid presentation geometry %#",
    (frameWidth, frameHeight, bounds, expectedMessage) => {
      expect(() =>
        createSeethingSwarmAnimalPresentationGeometry(
          frameWidth,
          frameHeight,
          bounds,
        ),
      ).toThrow(expectedMessage)
    },
  )

  it("creates a complete deeply frozen licensed presentation adapter", () => {
    const registry = createTestRegistry()
    const presentations = createTestPresentations(registry)
    const adapter = createSeethingSwarmLicensedAnimalPresentationAdapter(
      registry,
      presentations,
    )

    expect(adapter.mode).toBe("licensed")
    expect(adapter.evidenceSnapshotId).toBe(testEvidenceSnapshotId)
    expect(adapter.animals).toHaveLength(45)
    expect(Object.isFrozen(adapter)).toBe(true)
    expect(Object.isFrozen(adapter.animals)).toBe(true)
    expect(adapter.animals.every(Object.isFrozen)).toBe(true)
    expect(
      adapter.animals.every(({ visibleBounds }) =>
        Object.isFrozen(visibleBounds),
      ),
    ).toBe(true)
  })

  it("rejects incomplete duplicate mismatched and invalid presentations", () => {
    const registry = createTestRegistry()
    const presentations = createTestPresentations(registry)
    expect(() =>
      createSeethingSwarmLicensedAnimalPresentationAdapter(
        registry,
        presentations.slice(0, -1),
      ),
    ).toThrow(
      "Invalid SeethingSwarm Hub presentation count: expected 45, received 44",
    )
    expect(() =>
      createSeethingSwarmLicensedAnimalPresentationAdapter(
        registry,
        replaceAt(presentations, 1, presentations[0]!),
      ),
    ).toThrow("Invalid SeethingSwarm Hub animalId at position 1")
    expect(() =>
      createSeethingSwarmLicensedAnimalPresentationAdapter(
        registry,
        replaceAt(
          presentations,
          0,
          Object.freeze({ ...presentations[0]!, relativePath: "changed.png" }),
        ),
      ),
    ).toThrow("Invalid SeethingSwarm Hub relativePath at position 0")
    expect(() =>
      createSeethingSwarmLicensedAnimalPresentationAdapter(
        registry,
        replaceAt(
          presentations,
          0,
          Object.freeze({ ...presentations[0]!, frameOffsetX: 1 }),
        ),
      ),
    ).toThrow("Invalid SeethingSwarm Hub frameOffsetX for bat")
    expect(() =>
      createSeethingSwarmLicensedAnimalPresentationAdapter(
        registry,
        replaceAt(
          presentations,
          0,
          Object.freeze({ ...presentations[0]!, asset: null }),
        ),
      ),
    ).toThrow("Missing SeethingSwarm Hub asset")

    const missingFirstPresentation = Array.from(presentations)
    delete missingFirstPresentation[0]
    expect(() =>
      createSeethingSwarmLicensedAnimalPresentationAdapter(
        registry,
        missingFirstPresentation,
      ),
    ).toThrow("Missing SeethingSwarm Hub presentation at position 0")
  })

  it.each([
    ["animationId", "idle"],
    ["frameWidth", 31],
    ["frameHeight", 31],
    ["frameCount", 6],
    ["integerScale", 2],
    ["frameOffsetY", -11],
  ] as const)("rejects a mismatched %s", (property, changedValue) => {
    const registry = createTestRegistry()
    const presentations = createTestPresentations(registry)
    expect(() =>
      createSeethingSwarmLicensedAnimalPresentationAdapter(
        registry,
        replaceAt(
          presentations,
          0,
          Object.freeze({ ...presentations[0]!, [property]: changedValue }),
        ),
      ),
    ).toThrow(`Invalid SeethingSwarm Hub ${property}`)
  })

  it("rejects both nullish platform asset handles", () => {
    const registry = createTestRegistry()
    const presentations = createTestPresentations(registry)
    for (const asset of [null, undefined]) {
      expect(() =>
        createSeethingSwarmLicensedAnimalPresentationAdapter(
          registry,
          replaceAt(
            presentations,
            0,
            Object.freeze({ ...presentations[0]!, asset }),
          ),
        ),
      ).toThrow("Missing SeethingSwarm Hub asset")
    }
  })

  it("resolves all 100 canonical values through the frozen animal map", () => {
    const registry = createTestRegistry()
    const adapter = createSeethingSwarmLicensedAnimalPresentationAdapter(
      registry,
      createTestPresentations(registry),
    )
    const resolutions = CANONICAL_VALUES.map((value) =>
      resolveValueAnimalPresentation(value, adapter),
    )

    expect(resolutions).toHaveLength(100)
    expect(resolutions.every(({ kind }) => kind === "animal")).toBe(true)
    expect(
      new Set(
        resolutions.flatMap((resolution) =>
          resolution.kind === "animal" ? [resolution.animal.animalId] : [],
        ),
      ),
    ).toEqual(new Set(ZOO_ANIMALS.map(({ id }) => id)))
    expect(resolutions.every(Object.isFrozen)).toBe(true)
  })

  it("uses one authored grapheme for Custom Values without animal inference", () => {
    const registry = createTestRegistry()
    const adapter = createSeethingSwarmLicensedAnimalPresentationAdapter(
      registry,
      createTestPresentations(registry),
    )
    const customValue = Object.freeze({
      kind: "custom",
      id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
      name: "👩🏽‍🔬 Ingenuity",
      definition: "to solve unfamiliar problems inventively",
      creationOrdinal: 1,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    })

    expect(resolveValueAnimalPresentation(customValue, adapter)).toEqual({
      kind: "custom-initial",
      initial: "👩🏽‍🔬",
    })
    expect(() =>
      resolveValueAnimalPresentation({ ...customValue, name: "   " }, adapter),
    ).toThrow("Custom Value name must contain one grapheme")
  })

  it("preserves one frozen metadata-free result in typography-only mode", () => {
    const adapter = createSeethingSwarmTypographyOnlyAnimalPresentationAdapter()
    const canonicalResolution = resolveValueAnimalPresentation(
      CANONICAL_VALUES[0]!,
      adapter,
    )
    const customResolution = resolveValueAnimalPresentation(
      {
        kind: "custom",
        id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
        name: "Ingenuity",
        definition: "to solve unfamiliar problems inventively",
        creationOrdinal: 1,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
      adapter,
    )

    expect(adapter).toEqual({ mode: "typography-only" })
    expect(Object.keys(adapter)).toEqual(["mode"])
    expect(canonicalResolution).toBe(customResolution)
    expect(canonicalResolution).toEqual({ kind: "typography-only" })
    expect(Object.isFrozen(adapter)).toBe(true)
    expect(Object.isFrozen(canonicalResolution)).toBe(true)
  })

  it("rejects a canonical identity outside the approved mapping", () => {
    const registry = createTestRegistry()
    const adapter = createSeethingSwarmLicensedAnimalPresentationAdapter(
      registry,
      createTestPresentations(registry),
    )

    expect(() =>
      resolveValueAnimalPresentation(
        {
          kind: "canonical",
          id: createCanonicalValueId("pvcs-2011:invented"),
          sourceOrdinal: 101,
          englishName: "Invented",
          sourceDefinition: "not canonical",
        },
        adapter,
      ),
    ).toThrow("Missing animal mapping for canonical value")
  })

  it("rejects a licensed adapter missing its mapped animal", () => {
    const adapter = Object.freeze({
      mode: "licensed",
      evidenceSnapshotId: testEvidenceSnapshotId,
      animals: Object.freeze([]),
    })

    expect(() =>
      resolveValueAnimalPresentation(CANONICAL_VALUES[0]!, adapter),
    ).toThrow("Missing animal presentation for canonical value")
  })
})
