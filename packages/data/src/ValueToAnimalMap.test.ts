import { describe, expect, it } from "vitest"
import { CANONICAL_VALUES } from "./CanonicalValues"
import { VALUE_TO_ANIMAL_MAP } from "./ValueToAnimalMap"
import { ZOO_ANIMALS } from "./ZooAnimals"

const canonicalAnimalMapContentHash =
  "2517ef272e5bdae0162265af9078c947b0f053afbb6b762e1bf7d9e5ebcce415"

const retiredZooAnimalIds: readonly string[] = Object.freeze([
  "batpack",
  "cat01_brown",
  "cat02_dark_gray",
  "cat03_orange",
  "cat04_light_gray",
  "cat05_black",
  "dragonfly01_blue",
  "dragonfly02_yellow",
  "dragonfly03_pink",
  "dragonfly04_green",
  "kitten01_brown",
  "kitten02_dark_gray",
  "kitten03_orange",
  "kitten04_light_gray",
  "kitten05_black",
  "lildoggie01_brown",
  "lildoggie02_dark_gray",
  "lildoggie03_orange",
  "lildoggie04_light_gray",
  "lildoggie05_black",
  "lilfox_red",
  "lilfox_white",
  "mouse01_dark_gray",
  "mouse02_brown",
  "mouse03_light_gray",
  "turtle_spritesheets",
])

function serializeCanonicalAnimalMap() {
  return JSON.stringify(
    VALUE_TO_ANIMAL_MAP.map(({ valueId, animalId }) => ({
      valueId,
      animalId,
    })),
  )
}

async function createSha256Hash(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  )

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
}

describe("canonical value-to-animal mapping", () => {
  it("preserves the complete approved mapping", async () => {
    expect(VALUE_TO_ANIMAL_MAP).toHaveLength(100)
    expect(await createSha256Hash(serializeCanonicalAnimalMap())).toBe(
      canonicalAnimalMapContentHash,
    )
  })

  it("maps every canonical value exactly once", () => {
    const mappedValueIds = VALUE_TO_ANIMAL_MAP.map(({ valueId }) => valueId)

    expect(mappedValueIds).toEqual(CANONICAL_VALUES.map(({ id }) => id))
    expect(new Set(mappedValueIds).size).toBe(CANONICAL_VALUES.length)
  })

  it("uses every documented original-palette animal", () => {
    const documentedAnimalIds = ZOO_ANIMALS.map(({ id }) => id)
    const mappedAnimalIds = VALUE_TO_ANIMAL_MAP.map(({ animalId }) => animalId)

    expect(ZOO_ANIMALS).toHaveLength(45)
    expect(new Set(documentedAnimalIds).size).toBe(45)
    expect([...new Set(mappedAnimalIds)].sort()).toEqual(
      [...documentedAnimalIds].sort(),
    )
  })

  it("contains no manufactured hue identity", () => {
    expect(
      VALUE_TO_ANIMAL_MAP.map((mapping) => Object.keys(mapping).sort()),
    ).toEqual(Array.from({ length: 100 }, () => ["animalId", "valueId"]))
  })

  it("contains no retired animal aliases", () => {
    const executableAnimalIds = [
      ...ZOO_ANIMALS.map(({ id }) => id),
      ...VALUE_TO_ANIMAL_MAP.map(({ animalId }) => animalId),
    ]

    expect(
      executableAnimalIds.filter((id) => retiredZooAnimalIds.includes(id)),
    ).toEqual([])
  })

  it("keeps the inventory and mappings immutable", () => {
    expect(Object.isFrozen(ZOO_ANIMALS)).toBe(true)
    expect(ZOO_ANIMALS.every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(VALUE_TO_ANIMAL_MAP)).toBe(true)
    expect(VALUE_TO_ANIMAL_MAP.every(Object.isFrozen)).toBe(true)
  })
})
