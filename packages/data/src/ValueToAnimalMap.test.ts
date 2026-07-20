import { describe, expect, it } from "vitest"
import { CANONICAL_VALUES } from "./CanonicalValues"
import { VALUE_TO_ANIMAL_MAP } from "./ValueToAnimalMap"
import { ZOO_ANIMALS } from "./ZooAnimals"

const canonicalAnimalMapContentHash =
  "413d5f14eaf86062ee1c7da4d29b3d3451e1d0ed85c0f6122d4b548e59cded32"

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

  it("keeps the inventory and mappings immutable", () => {
    expect(Object.isFrozen(ZOO_ANIMALS)).toBe(true)
    expect(ZOO_ANIMALS.every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(VALUE_TO_ANIMAL_MAP)).toBe(true)
    expect(VALUE_TO_ANIMAL_MAP.every(Object.isFrozen)).toBe(true)
  })
})
