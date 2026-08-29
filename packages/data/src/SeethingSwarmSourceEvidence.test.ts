import { describe, expect, it } from "vitest"
import {
  SEETHING_SWARM_SOURCE_PACKS,
  SEETHING_SWARM_SOURCE_SNAPSHOT,
} from "./SeethingSwarmSourceEvidence"
import { ZOO_ANIMALS } from "./ZooAnimals"

const EXPECTED_PACK_IDS = Object.freeze([
  "batpack",
  "bunnypack",
  "catset",
  "catset-kittens",
  "chickenpack",
  "cranepack",
  "crowpack",
  "deerpack",
  "dogpack",
  "dragonflypack",
  "falconpack",
  "foxpack",
  "frogpack",
  "lil-axolotl",
  "lil-doggies",
  "lil-fox",
  "lil-hedgehog",
  "lil-otter",
  "lil-pig",
  "mousepack",
  "owlpack",
  "pandapack",
  "parrotpack",
  "pigpack",
  "raccoonpack",
  "turtlepack",
  "wolfpack",
])

const EXPECTED_EVIDENCE_FILES = Object.freeze([
  Object.freeze({
    relativePath:
      "seethingswarm_animals_full_animation_list_with_frame_count.txt",
    sha256: "2C5AFDBBC911F1C94BFAD9499890AC6D3A1BBDB16EC4614AAA8937E0BE5AFF4C",
  }),
  Object.freeze({
    relativePath: "seethingswarm_animals_colors_list.txt",
    sha256: "7E4E37C4C3E308B7C1D0CF493909ADBF6B3AE347A54E7A18CA205F977FFC8C9E",
  }),
  Object.freeze({
    relativePath: "seethingswarm_animals_spritesheet_sizes.txt",
    sha256: "D06AA917785C577F64D1C0581B4A5D2BEADF87AF5098F40D3FEAA55FE42B59E7",
  }),
  Object.freeze({
    relativePath: "LICENSE.txt",
    sha256: "13F97ABBA7D10CBCFD343EBA184B704C8BA329D5434818BC05A6D1ECF6E38200",
  }),
])

describe("SeethingSwarm source evidence", () => {
  it("locks the audited source-snapshot arithmetic and evidence hashes", () => {
    expect(SEETHING_SWARM_SOURCE_SNAPSHOT).toMatchObject({
      sourceSnapshotId: "seethingswarm-animals:2026-03-15",
      storefrontReviewedOn: "2026-08-29",
      packCount: 27,
      stableAnimalCount: 45,
      characterAnimationStripCount: 774,
      auxiliaryEffectStripCount: 1,
      excludedHumanWeaponStripCount: 102,
      totalPngStripCount: 877,
      distinctAnimationIdCount: 86,
    })
    expect(
      SEETHING_SWARM_SOURCE_SNAPSHOT.characterAnimationStripCount +
        SEETHING_SWARM_SOURCE_SNAPSHOT.auxiliaryEffectStripCount +
        SEETHING_SWARM_SOURCE_SNAPSHOT.excludedHumanWeaponStripCount,
    ).toBe(SEETHING_SWARM_SOURCE_SNAPSHOT.totalPngStripCount)
    expect(SEETHING_SWARM_SOURCE_SNAPSHOT.evidenceFiles).toEqual(
      EXPECTED_EVIDENCE_FILES,
    )
  })

  it("covers the exact twenty-seven official source packs", () => {
    const packIds = SEETHING_SWARM_SOURCE_PACKS.map(({ packId }) => packId)

    expect(SEETHING_SWARM_SOURCE_PACKS).toHaveLength(
      SEETHING_SWARM_SOURCE_SNAPSHOT.packCount,
    )
    expect(packIds).toEqual(EXPECTED_PACK_IDS)
    expect(new Set(packIds).size).toBe(EXPECTED_PACK_IDS.length)
  })

  it("assigns every stable animal to exactly one source pack", () => {
    const documentedAnimalIds = ZOO_ANIMALS.map(({ id }) => id).sort()
    const sourceAnimalIds = SEETHING_SWARM_SOURCE_PACKS.flatMap(
      ({ animalIds }) => animalIds,
    ).sort()

    expect(sourceAnimalIds).toHaveLength(
      SEETHING_SWARM_SOURCE_SNAPSHOT.stableAnimalCount,
    )
    expect(new Set(sourceAnimalIds).size).toBe(sourceAnimalIds.length)
    expect(sourceAnimalIds).toEqual(documentedAnimalIds)
  })

  it("uses only official storefront URLs and safe unique source directories", () => {
    const sourceDirectories = SEETHING_SWARM_SOURCE_PACKS.map(
      ({ sourceDirectory }) => sourceDirectory,
    )

    expect(new Set(sourceDirectories).size).toBe(sourceDirectories.length)

    for (const sourcePack of SEETHING_SWARM_SOURCE_PACKS) {
      const storefrontUrl = new URL(sourcePack.storefrontUrl)

      expect(storefrontUrl.origin).toBe("https://seethingswarm.itch.io")
      expect(storefrontUrl.pathname).toBe(`/${sourcePack.packId}`)
      expect(sourcePack.storefrontTitle.trim()).not.toBe("")
      expect(sourcePack.sourceDirectory).toMatch(
        /^[a-z0-9]+(?:_[a-z0-9]+)*_spritesheets$/,
      )
      expect(sourcePack.sourceSnapshotId).toBe(
        SEETHING_SWARM_SOURCE_SNAPSHOT.sourceSnapshotId,
      )
    }
  })

  it("uses unique safe evidence paths and uppercase SHA-256 values", () => {
    const evidencePaths = SEETHING_SWARM_SOURCE_SNAPSHOT.evidenceFiles.map(
      ({ relativePath }) => relativePath,
    )

    expect(new Set(evidencePaths).size).toBe(evidencePaths.length)

    for (const evidenceFile of SEETHING_SWARM_SOURCE_SNAPSHOT.evidenceFiles) {
      expect(evidenceFile.relativePath).not.toMatch(/[\\/]/)
      expect(evidenceFile.relativePath).not.toBe(".")
      expect(evidenceFile.relativePath).not.toBe("..")
      expect(evidenceFile.sha256).toMatch(/^[A-F0-9]{64}$/)
    }
  })

  it("deeply freezes the public provenance ledger", () => {
    expect(Object.isFrozen(SEETHING_SWARM_SOURCE_SNAPSHOT)).toBe(true)
    expect(Object.isFrozen(SEETHING_SWARM_SOURCE_SNAPSHOT.evidenceFiles)).toBe(
      true,
    )
    expect(
      SEETHING_SWARM_SOURCE_SNAPSHOT.evidenceFiles.every(Object.isFrozen),
    ).toBe(true)
    expect(Object.isFrozen(SEETHING_SWARM_SOURCE_PACKS)).toBe(true)
    expect(SEETHING_SWARM_SOURCE_PACKS.every(Object.isFrozen)).toBe(true)
    expect(
      SEETHING_SWARM_SOURCE_PACKS.every(({ animalIds }) =>
        Object.isFrozen(animalIds),
      ),
    ).toBe(true)
  })
})
