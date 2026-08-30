import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  validateSeethingSwarmSnapshotAgainstExpectation,
  type SeethingSwarmSnapshotExpectation,
} from "./SeethingSwarmSnapshotValidator"

const evidencePaths = Object.freeze({
  animations: "seethingswarm_animals_full_animation_list_with_frame_count.txt",
  palettes: "seethingswarm_animals_colors_list.txt",
  geometry: "seethingswarm_animals_spritesheet_sizes.txt",
  license: "LICENSE.txt",
})

const animationPaths = Object.freeze({
  character: "frogpack_spritesheets/frog_idle_strip2.png",
  effect: "frogpack_spritesheets/fly_fly_strip2.png",
  excludedHero: "lilwarhero_spritesheets/hero_idle_strip1.png",
  excludedNinja: "lilmaskedninja_spritesheets/shuriken_idle_strip1.png",
})

const temporaryDirectories: string[] = []

type SyntheticSnapshot = Readonly<{
  sourceRoot: string
  expectation: SeethingSwarmSnapshotExpectation
  evidenceContents: Readonly<Record<string, Buffer>>
}>

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

function createPngHeader(width: number, height: number) {
  const pngHeader = Buffer.alloc(24)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(pngHeader)
  pngHeader.writeUInt32BE(13, 8)
  pngHeader.write("IHDR", 12, "ascii")
  pngHeader.writeUInt32BE(width, 16)
  pngHeader.writeUInt32BE(height, 20)
  return pngHeader
}

function sha256(fileBuffer: Buffer) {
  return createHash("sha256").update(fileBuffer).digest("hex").toUpperCase()
}

async function writeRelativeFile(
  sourceRoot: string,
  relativePath: string,
  contents: Buffer,
) {
  const absolutePath = join(sourceRoot, ...relativePath.split("/"))
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, contents)
}

function createExpectation(
  evidenceContents: Readonly<Record<string, Buffer>>,
  overrides: Partial<SeethingSwarmSnapshotExpectation> = {},
) {
  return Object.freeze({
    evidenceSnapshotId: "synthetic-seethingswarm-snapshot",
    characterAnimationStripCount: 1,
    auxiliaryEffectStripCount: 1,
    excludedHumanWeaponStripCount: 2,
    totalPngStripCount: 4,
    evidenceFiles: Object.freeze(
      Object.values(evidencePaths).map((relativePath) =>
        Object.freeze({
          relativePath,
          sha256: sha256(evidenceContents[relativePath]!),
        }),
      ),
    ),
    animalSourceDirectories: Object.freeze(["frogpack_spritesheets"]),
    ...overrides,
  }) satisfies SeethingSwarmSnapshotExpectation
}

async function createSyntheticSnapshot() {
  const sourceRoot = await mkdtemp(join(tmpdir(), "wayvm-seethingswarm-"))
  temporaryDirectories.push(sourceRoot)

  const evidenceContents = Object.freeze({
    [evidencePaths.animations]: Buffer.from(
      `\uFEFF${[
        `${animationPaths.character} -> idle -> 2 frames`,
        `${animationPaths.effect} -> fly -> 2 frames`,
        `${animationPaths.excludedHero} -> idle -> 1 frames`,
        `${animationPaths.excludedNinja} -> shuriken_idle -> 1 frames`,
      ].join("\r\n")}\r\n`,
      "utf8",
    ),
    [evidencePaths.palettes]: Buffer.from(
      `\uFEFF${[
        "frogpack_spritesheets -> green",
        "lilwarhero_spritesheets -> assaultrifle",
        "lilmaskedninja_spritesheets -> dark_gray",
      ].join("\r\n")}\r\n`,
      "utf8",
    ),
    [evidencePaths.geometry]: Buffer.from(
      `\uFEFF${[
        "frogpack_spritesheets -> 2x2",
        "lilwarhero_spritesheets -> 60x60",
        "lilmaskedninja_spritesheets -> 60x60",
      ].join("\r\n")}\r\n`,
      "utf8",
    ),
    [evidencePaths.license]: Buffer.from("Synthetic test fixture only.\n"),
  })

  for (const [relativePath, contents] of Object.entries(evidenceContents)) {
    await writeRelativeFile(sourceRoot, relativePath, contents)
  }
  await writeRelativeFile(
    sourceRoot,
    animationPaths.character,
    createPngHeader(4, 2),
  )
  await writeRelativeFile(
    sourceRoot,
    animationPaths.effect,
    createPngHeader(16, 6),
  )
  await writeRelativeFile(
    sourceRoot,
    animationPaths.excludedHero,
    createPngHeader(8, 8),
  )
  await writeRelativeFile(
    sourceRoot,
    animationPaths.excludedNinja,
    createPngHeader(7, 5),
  )

  return Object.freeze({
    sourceRoot,
    expectation: createExpectation(evidenceContents),
    evidenceContents,
  }) satisfies SyntheticSnapshot
}

async function replaceAnimationEvidence(
  snapshot: SyntheticSnapshot,
  animationEvidence: string,
  expectationOverrides: Partial<SeethingSwarmSnapshotExpectation> = {},
) {
  const updatedAnimationEvidence = Buffer.from(animationEvidence, "utf8")
  await writeRelativeFile(
    snapshot.sourceRoot,
    evidencePaths.animations,
    updatedAnimationEvidence,
  )
  const updatedEvidenceContents = Object.freeze({
    ...snapshot.evidenceContents,
    [evidencePaths.animations]: updatedAnimationEvidence,
  })

  return createExpectation(updatedEvidenceContents, expectationOverrides)
}

describe("SeethingSwarm snapshot validator", () => {
  it("validates and deeply freezes a complete synthetic snapshot", async () => {
    const fixture = await createSyntheticSnapshot()
    const snapshot = await validateSeethingSwarmSnapshotAgainstExpectation(
      fixture.sourceRoot,
      fixture.expectation,
    )

    expect(snapshot.characterAnimations).toHaveLength(1)
    expect(snapshot.auxiliaryEffects).toHaveLength(1)
    expect(snapshot.excludedAnimations).toHaveLength(2)
    expect(snapshot.characterAnimations[0]).toMatchObject({
      relativePath: animationPaths.character,
      frameWidth: 2,
      frameHeight: 2,
      pngWidth: 4,
      pngHeight: 2,
    })
    expect(snapshot.auxiliaryEffects[0]).toMatchObject({
      relativePath: animationPaths.effect,
      frameWidth: 8,
      frameHeight: 6,
      pngWidth: 16,
      pngHeight: 6,
    })
    expect(JSON.stringify(snapshot)).not.toContain(fixture.sourceRoot)

    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.evidenceFiles)).toBe(true)
    expect(snapshot.evidenceFiles.every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(snapshot.characterAnimations)).toBe(true)
    expect(snapshot.characterAnimations.every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(snapshot.auxiliaryEffects)).toBe(true)
    expect(snapshot.auxiliaryEffects.every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(snapshot.excludedAnimations)).toBe(true)
    expect(snapshot.excludedAnimations.every(Object.isFrozen)).toBe(true)
  })

  it("rejects altered evidence before trusting its contents", async () => {
    const fixture = await createSyntheticSnapshot()
    await writeRelativeFile(
      fixture.sourceRoot,
      evidencePaths.animations,
      Buffer.from("altered evidence\n"),
    )

    await expect(
      validateSeethingSwarmSnapshotAgainstExpectation(
        fixture.sourceRoot,
        fixture.expectation,
      ),
    ).rejects.toThrow("SeethingSwarm evidence hash mismatch")
  })

  it("rejects a missing or unexpected PNG", async () => {
    const missingFixture = await createSyntheticSnapshot()
    await rm(
      join(missingFixture.sourceRoot, ...animationPaths.character.split("/")),
    )

    await expect(
      validateSeethingSwarmSnapshotAgainstExpectation(
        missingFixture.sourceRoot,
        missingFixture.expectation,
      ),
    ).rejects.toThrow("Invalid SeethingSwarm source PNG count")

    const unexpectedFixture = await createSyntheticSnapshot()
    await writeRelativeFile(
      unexpectedFixture.sourceRoot,
      "unexpected_spritesheets/unexpected.png",
      createPngHeader(1, 1),
    )

    await expect(
      validateSeethingSwarmSnapshotAgainstExpectation(
        unexpectedFixture.sourceRoot,
        unexpectedFixture.expectation,
      ),
    ).rejects.toThrow("Invalid SeethingSwarm source PNG count")
  })

  it("rejects traversal and case-colliding inventory paths", async () => {
    const traversalFixture = await createSyntheticSnapshot()
    const traversalExpectation = await replaceAnimationEvidence(
      traversalFixture,
      [
        "../frog_idle_strip2.png -> idle -> 2 frames",
        `${animationPaths.effect} -> fly -> 2 frames`,
        `${animationPaths.excludedHero} -> idle -> 1 frames`,
        `${animationPaths.excludedNinja} -> shuriken_idle -> 1 frames`,
      ].join("\n"),
    )

    await expect(
      validateSeethingSwarmSnapshotAgainstExpectation(
        traversalFixture.sourceRoot,
        traversalExpectation,
      ),
    ).rejects.toThrow("Invalid animation evidence path")

    const collisionFixture = await createSyntheticSnapshot()
    const collisionExpectation = await replaceAnimationEvidence(
      collisionFixture,
      [
        `${animationPaths.character} -> idle -> 2 frames`,
        `${animationPaths.character.replace("frogpack", "FROGPACK")} -> run -> 2 frames`,
        `${animationPaths.effect} -> fly -> 2 frames`,
        `${animationPaths.excludedHero} -> idle -> 1 frames`,
        `${animationPaths.excludedNinja} -> shuriken_idle -> 1 frames`,
      ].join("\n"),
      {
        characterAnimationStripCount: 2,
        totalPngStripCount: 5,
      },
    )

    await expect(
      validateSeethingSwarmSnapshotAgainstExpectation(
        collisionFixture.sourceRoot,
        collisionExpectation,
      ),
    ).rejects.toThrow("Duplicate animation evidence path")
  })

  it("rejects a malformed PNG header", async () => {
    const fixture = await createSyntheticSnapshot()
    await writeRelativeFile(
      fixture.sourceRoot,
      animationPaths.character,
      Buffer.from("not a PNG"),
    )

    await expect(
      validateSeethingSwarmSnapshotAgainstExpectation(
        fixture.sourceRoot,
        fixture.expectation,
      ),
    ).rejects.toThrow("Invalid SeethingSwarm PNG header")
  })

  it.each([
    ["width", 3, 2],
    ["height", 4, 3],
  ])("rejects an invalid character PNG %s", async (_, width, height) => {
    const fixture = await createSyntheticSnapshot()
    await writeRelativeFile(
      fixture.sourceRoot,
      animationPaths.character,
      createPngHeader(width, height),
    )

    await expect(
      validateSeethingSwarmSnapshotAgainstExpectation(
        fixture.sourceRoot,
        fixture.expectation,
      ),
    ).rejects.toThrow(`Invalid SeethingSwarm PNG ${_}`)
  })

  it("keeps excluded human and weapon records outside animal scope", async () => {
    const fixture = await createSyntheticSnapshot()
    const leakingExpectation = Object.freeze({
      ...fixture.expectation,
      animalSourceDirectories: Object.freeze([
        "frogpack_spritesheets",
        "lilwarhero_spritesheets",
      ]),
    })

    await expect(
      validateSeethingSwarmSnapshotAgainstExpectation(
        fixture.sourceRoot,
        leakingExpectation,
      ),
    ).rejects.toThrow(
      "Invalid SeethingSwarm PNG width for lilwarhero_spritesheets",
    )
  })
})
