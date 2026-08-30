import {
  SEETHING_SWARM_SOURCE_PACKS,
  SEETHING_SWARM_SOURCE_SNAPSHOT,
  type SeethingSwarmSourcePack,
} from "#game/data/src/SeethingSwarmSourceEvidence"
import { ZOO_ANIMALS, type ZooAnimalId } from "#game/data/src/ZooAnimals"
import { describe, expect, it } from "vitest"
import {
  parseSeethingSwarmAnimationEvidence,
  parseSeethingSwarmGeometryEvidence,
  parseSeethingSwarmPaletteEvidence,
} from "./SeethingSwarmEvidenceParser"
import { generateSeethingSwarmAnimalRegistry } from "./SeethingSwarmRegistryGenerator"
import type {
  SeethingSwarmValidatedAnimation,
  SeethingSwarmValidatedSnapshot,
} from "./SeethingSwarmSnapshotValidator"

const frogpackEffectPath = "frogpack_spritesheets/fly_fly_strip2.png"

function getSourcePack(animalId: ZooAnimalId) {
  const sourcePack = SEETHING_SWARM_SOURCE_PACKS.find(({ animalIds }) =>
    animalIds.includes(animalId),
  )
  if (!sourcePack) throw new Error(`Missing test source pack: ${animalId}`)
  return sourcePack
}

function getSourceRelativePath(
  sourcePack: SeethingSwarmSourcePack,
  animalId: ZooAnimalId,
) {
  if (sourcePack.animalIds.length === 1) return sourcePack.sourceDirectory
  return `${sourcePack.sourceDirectory}/${animalId.split("/").at(-1)!}_spritesheets`
}

function createAnimationLines() {
  const characterLines = ZOO_ANIMALS.flatMap(({ id }, animalIndex) => {
    const sourceRelativePath = getSourceRelativePath(getSourcePack(id), id)
    const animationCount = animalIndex === 0 ? 26 : 17
    return Array.from({ length: animationCount }, (_, animationIndex) => {
      const frameCount = (animationIndex % 8) + 1
      return `${sourceRelativePath}/animation_${animationIndex}.png -> animation_${animationIndex} -> ${frameCount} frames`
    })
  })

  return Object.freeze([
    ...characterLines,
    `${frogpackEffectPath} -> fly -> 2 frames`,
  ])
}

function createPaletteLines() {
  return Object.freeze(
    ZOO_ANIMALS.map(({ id }, animalIndex) => {
      const sourceRelativePath = getSourceRelativePath(getSourcePack(id), id)
      return `${sourceRelativePath} -> color_${animalIndex}`
    }),
  )
}

function createGeometryLines() {
  return Object.freeze(
    SEETHING_SWARM_SOURCE_PACKS.map(
      ({ sourceDirectory }) => `${sourceDirectory} -> 32x32`,
    ),
  )
}

function createValidatedAnimation(
  animation: ReturnType<typeof parseSeethingSwarmAnimationEvidence>[number],
) {
  const isAuxiliaryEffect = animation.relativePath === frogpackEffectPath
  const frameWidth = isAuxiliaryEffect ? 8 : 32
  const frameHeight = isAuxiliaryEffect ? 6 : 32

  return Object.freeze({
    ...animation,
    sourceDirectory: animation.relativePath.split("/")[0]!,
    frameWidth,
    frameHeight,
    pngWidth: frameWidth * animation.frameCount,
    pngHeight: frameHeight,
  }) satisfies SeethingSwarmValidatedAnimation
}

function createCompleteValidatedSnapshot(
  lineEnding: "\n" | "\r\n" = "\n",
  reverseEvidence = false,
) {
  const orderLines = (lines: readonly string[]) =>
    reverseEvidence ? lines.toReversed() : lines
  const animationEvidence = parseSeethingSwarmAnimationEvidence(
    `${orderLines(createAnimationLines()).join(lineEnding)}${lineEnding}`,
  ).map(createValidatedAnimation)
  const paletteEvidence = parseSeethingSwarmPaletteEvidence(
    `${orderLines(createPaletteLines()).join(lineEnding)}${lineEnding}`,
  )
  const geometryEvidence = parseSeethingSwarmGeometryEvidence(
    `${orderLines(createGeometryLines()).join(lineEnding)}${lineEnding}`,
  )

  return Object.freeze({
    evidenceSnapshotId: SEETHING_SWARM_SOURCE_SNAPSHOT.sourceSnapshotId,
    evidenceFiles: SEETHING_SWARM_SOURCE_SNAPSHOT.evidenceFiles,
    paletteEvidence,
    geometryEvidence,
    characterAnimations: Object.freeze(
      animationEvidence.filter(
        ({ relativePath }) => relativePath !== frogpackEffectPath,
      ),
    ),
    auxiliaryEffects: Object.freeze(
      animationEvidence.filter(
        ({ relativePath }) => relativePath === frogpackEffectPath,
      ),
    ),
    excludedAnimations: Object.freeze([]),
  }) satisfies SeethingSwarmValidatedSnapshot
}

describe("SeethingSwarm registry generator", () => {
  it("generates the complete canonical registry with Frogpack effect separation", () => {
    const generated = generateSeethingSwarmAnimalRegistry(
      createCompleteValidatedSnapshot(),
    )
    const frogpack = generated.registry.animals.find(
      ({ animalId }) => animalId === "frogpack",
    )!

    expect(generated.registry.animals).toHaveLength(45)
    expect(generated.registry.animals.map(({ animalId }) => animalId)).toEqual(
      ZOO_ANIMALS.map(({ id }) => id),
    )
    expect(generated.registry.characterAnimationCount).toBe(774)
    expect(generated.registry.auxiliaryEffectCount).toBe(1)
    expect(frogpack.animations.fly).toBeUndefined()
    expect(frogpack.auxiliaryEffects?.fly).toEqual({
      relativePath: frogpackEffectPath,
      frameWidth: 8,
      frameHeight: 6,
      frameCount: 2,
    })
  })

  it("maps every stable identity to its canonical family and variant path", () => {
    const { registry } = generateSeethingSwarmAnimalRegistry(
      createCompleteValidatedSnapshot(),
    )

    for (const manifest of registry.animals) {
      const sourcePack = getSourcePack(manifest.animalId)
      expect(manifest.familyId).toBe(
        sourcePack.sourceDirectory.replace(/_spritesheets$/, ""),
      )
      expect(manifest.sourceRelativePath).toBe(
        getSourceRelativePath(sourcePack, manifest.animalId),
      )
    }
  })

  it("serializes equivalent LF and CRLF evidence byte for byte", () => {
    const lfGenerated = generateSeethingSwarmAnimalRegistry(
      createCompleteValidatedSnapshot("\n"),
    )
    const crlfGenerated = generateSeethingSwarmAnimalRegistry(
      createCompleteValidatedSnapshot("\r\n", true),
    )

    expect(crlfGenerated.serializedRegistry).toBe(
      lfGenerated.serializedRegistry,
    )
    expect(crlfGenerated.serializedRegistry.endsWith("\n")).toBe(true)
    expect(crlfGenerated.serializedRegistry).not.toMatch(/[A-Za-z]:[\\/]/)
    expect(crlfGenerated.serializedRegistry).not.toContain("\\")
    expect(crlfGenerated.serializedRegistry).not.toContain("lilwarhero")
    expect(crlfGenerated.serializedRegistry).not.toContain("lilmaskedninja")
  })

  it("deeply freezes generated registry metadata", () => {
    const { registry } = generateSeethingSwarmAnimalRegistry(
      createCompleteValidatedSnapshot(),
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
  })

  it("rejects a noncanonical snapshot", () => {
    const snapshot = createCompleteValidatedSnapshot()

    expect(() =>
      generateSeethingSwarmAnimalRegistry({
        ...snapshot,
        evidenceSnapshotId: "wrong-snapshot",
      }),
    ).toThrow("Invalid SeethingSwarm generator snapshot")
  })

  it("rejects missing and unmatched animal palette records", () => {
    const snapshot = createCompleteValidatedSnapshot()

    expect(() =>
      generateSeethingSwarmAnimalRegistry({
        ...snapshot,
        paletteEvidence: Object.freeze(snapshot.paletteEvidence.slice(1)),
      }),
    ).toThrow("Missing SeethingSwarm palette evidence")
    expect(() =>
      generateSeethingSwarmAnimalRegistry({
        ...snapshot,
        paletteEvidence: Object.freeze([
          ...snapshot.paletteEvidence,
          Object.freeze({
            sourceRelativePath: "frogpack_spritesheets/unmatched_spritesheets",
            colorLabel: "green",
          }),
        ]),
      }),
    ).toThrow("Unmatched SeethingSwarm animal palette path")
  })

  it("rejects conflicting character geometry within one animal", () => {
    const snapshot = createCompleteValidatedSnapshot()
    const firstAnimation = snapshot.characterAnimations[0]!

    expect(() =>
      generateSeethingSwarmAnimalRegistry({
        ...snapshot,
        characterAnimations: Object.freeze([
          Object.freeze({ ...firstAnimation, frameWidth: 64 }),
          ...snapshot.characterAnimations.slice(1),
        ]),
      }),
    ).toThrow("Conflicting SeethingSwarm character geometry")
  })
})
