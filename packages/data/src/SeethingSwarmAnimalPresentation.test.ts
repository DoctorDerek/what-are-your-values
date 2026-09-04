import { describe, expect, it } from "vitest"
import { CANONICAL_VALUES } from "./CanonicalValues"
import {
  createSeethingSwarmAnimalPresentationGeometry,
  resolveValueAnimalPresentation,
  SEETHING_SWARM_HUB_ANIMATION_CANDIDATES,
  SEETHING_SWARM_HUB_FRAME_DURATION_MS,
  SEETHING_SWARM_HUB_TILE_SIZE,
} from "./SeethingSwarmAnimalPresentation"
import {
  createSeethingSwarmTypographyOnlyRuntimeClipCatalog,
  type SeethingSwarmLicensedRuntimeClipCatalog,
  type SeethingSwarmRuntimeAnimalClips,
} from "./SeethingSwarmRuntimeClipCatalog"
import { createCompleteSeethingSwarmRuntimeClipTestFixture } from "./SeethingSwarmRuntimeClipCatalog.test-fixture"
import { createCanonicalValueId, createCustomValueId } from "./Value"
import { ZOO_ANIMALS } from "./ZooAnimals"

const customValue = Object.freeze({
  kind: "custom",
  id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
  name: "👩🏽‍🔬 Ingenuity",
  definition: "to solve unfamiliar problems inventively",
  creationOrdinal: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
})

function replaceAnimal(
  catalog: SeethingSwarmLicensedRuntimeClipCatalog<string>,
  animalIndex: number,
  replacement: SeethingSwarmRuntimeAnimalClips<string>,
) {
  return Object.freeze({
    ...catalog,
    animals: Object.freeze(
      catalog.animals.map((animal, index) =>
        index === animalIndex ? replacement : animal,
      ),
    ),
  })
}

function isCalmAnimation(animationId: string) {
  return SEETHING_SWARM_HUB_ANIMATION_CANDIDATES.some(
    (candidate) => candidate === animationId,
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

  it("preserves bottom-center geometry inside a larger requested tile", () => {
    expect(
      createSeethingSwarmAnimalPresentationGeometry(
        32,
        32,
        {
          left: 2,
          top: 4,
          width: 20,
          height: 24,
        },
        120,
      ),
    ).toEqual({
      visibleBounds: { left: 2, top: 4, width: 20, height: 24 },
      integerScale: 5,
      frameOffsetX: 0,
      frameOffsetY: -20,
    })
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
    [32, 32, { left: 0, top: 0, width: 1, height: 1 }, "tile size", 0],
  ] as const)(
    "rejects invalid presentation geometry %#",
    (frameWidth, frameHeight, bounds, expectedMessage, tileSize) => {
      expect(() =>
        createSeethingSwarmAnimalPresentationGeometry(
          frameWidth,
          frameHeight,
          bounds,
          tileSize,
        ),
      ).toThrow(expectedMessage)
    },
  )

  it("resolves all 100 canonical values through calm catalog clips", () => {
    const { catalog } = createCompleteSeethingSwarmRuntimeClipTestFixture()
    const resolutions = CANONICAL_VALUES.map((value) =>
      resolveValueAnimalPresentation(value, catalog),
    )

    expect(resolutions).toHaveLength(100)
    expect(resolutions.every(({ kind }) => kind === "animal")).toBe(true)
    expect(
      new Set(
        resolutions.flatMap((resolution) =>
          resolution.kind === "animal" ? [resolution.clip.animalId] : [],
        ),
      ),
    ).toEqual(new Set(ZOO_ANIMALS.map(({ id }) => id)))
    expect(
      resolutions.every(
        (resolution) =>
          resolution.kind === "animal" &&
          isCalmAnimation(resolution.clip.animationId),
      ),
    ).toBe(true)
    expect(resolutions.every(Object.isFrozen)).toBe(true)
  })

  it("prefers idle over idle upright regardless of catalog clip order", () => {
    const { catalog } = createCompleteSeethingSwarmRuntimeClipTestFixture()
    const bat = catalog.animals[0]!
    const idleUpright = bat.characterClips.find(
      ({ animationId }) => animationId === "idle_upright",
    )!
    const catalogWithBothCalmClips = replaceAnimal(
      catalog,
      0,
      Object.freeze({
        ...bat,
        characterClips: Object.freeze([
          idleUpright,
          Object.freeze({ ...idleUpright, animationId: "idle" }),
        ]),
      }),
    )
    const mappedBatValue = CANONICAL_VALUES.find((value) => {
      const presentation = resolveValueAnimalPresentation(value, catalog)
      return (
        presentation.kind === "animal" && presentation.clip.animalId === "bat"
      )
    })!

    expect(
      resolveValueAnimalPresentation(mappedBatValue, catalogWithBothCalmClips),
    ).toMatchObject({ kind: "animal", clip: { animationId: "idle" } })
  })

  it("uses one authored grapheme for Custom Values without animal inference", () => {
    const { catalog } = createCompleteSeethingSwarmRuntimeClipTestFixture()

    expect(resolveValueAnimalPresentation(customValue, catalog)).toEqual({
      kind: "custom-initial",
      initial: "👩🏽‍🔬",
    })
    expect(() =>
      resolveValueAnimalPresentation({ ...customValue, name: "   " }, catalog),
    ).toThrow("Custom Value name must contain one grapheme")
  })

  it("preserves one frozen metadata-free result in typography-only mode", () => {
    const catalog = createSeethingSwarmTypographyOnlyRuntimeClipCatalog()
    const canonicalResolution = resolveValueAnimalPresentation(
      CANONICAL_VALUES[0]!,
      catalog,
    )
    const customResolution = resolveValueAnimalPresentation(
      customValue,
      catalog,
    )

    expect(canonicalResolution).toBe(customResolution)
    expect(canonicalResolution).toEqual({ kind: "typography-only" })
    expect(Object.isFrozen(canonicalResolution)).toBe(true)
  })

  it("rejects missing canonical mappings animals and calm clips", () => {
    const { catalog } = createCompleteSeethingSwarmRuntimeClipTestFixture()
    expect(() =>
      resolveValueAnimalPresentation(
        {
          kind: "canonical",
          id: createCanonicalValueId("pvcs-2011:invented"),
          sourceOrdinal: 101,
          englishName: "Invented",
          sourceDefinition: "not canonical",
        },
        catalog,
      ),
    ).toThrow("Missing animal mapping for canonical value")

    const mappedPresentation = resolveValueAnimalPresentation(
      CANONICAL_VALUES[0]!,
      catalog,
    )
    if (mappedPresentation.kind !== "animal") {
      throw new Error("Expected licensed canonical animal presentation")
    }
    const mappedAnimalIndex = catalog.animals.findIndex(
      ({ animalId }) => animalId === mappedPresentation.clip.animalId,
    )
    const mappedAnimal = catalog.animals[mappedAnimalIndex]!
    expect(() =>
      resolveValueAnimalPresentation(CANONICAL_VALUES[0]!, {
        ...catalog,
        animals: catalog.animals.filter(
          ({ animalId }) => animalId !== mappedAnimal.animalId,
        ),
      }),
    ).toThrow("Missing animal presentation for animal")
    expect(() =>
      resolveValueAnimalPresentation(
        CANONICAL_VALUES[0]!,
        replaceAnimal(
          catalog,
          mappedAnimalIndex,
          Object.freeze({
            ...mappedAnimal,
            characterClips: Object.freeze(
              mappedAnimal.characterClips.filter(
                ({ animationId }) => !isCalmAnimation(animationId),
              ),
            ),
          }),
        ),
      ),
    ).toThrow("Missing calm SeethingSwarm Hub animation")
  })
})
