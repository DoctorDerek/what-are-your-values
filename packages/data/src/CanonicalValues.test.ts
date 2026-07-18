import { describe, expect, it } from "vitest"
import { CANONICAL_VALUES, getCanonicalValueById } from "./CanonicalValues"
import {
  createCanonicalValueId,
  createCustomValueId,
  isCanonicalValueId,
  isCustomValueId,
} from "./Value"

const canonicalCatalogContentHash =
  "94f941d80b625b49b59fe08084150d505d7ed447a117993be74f240b2a938f07"

function serializeCanonicalCatalog() {
  return JSON.stringify(
    CANONICAL_VALUES.map(
      ({ id, sourceOrdinal, englishName, sourceDefinition }) => ({
        id,
        sourceOrdinal,
        englishName,
        sourceDefinition,
      }),
    ),
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

describe("canonical values", () => {
  it("preserves the complete verified 2011 source catalog", async () => {
    expect(CANONICAL_VALUES).toHaveLength(100)
    expect(await createSha256Hash(serializeCanonicalCatalog())).toBe(
      canonicalCatalogContentHash,
    )
  })

  it("uses unique semantic IDs and contiguous source ordinals", () => {
    const ids = CANONICAL_VALUES.map(({ id }) => id)
    const ordinals = CANONICAL_VALUES.map(({ sourceOrdinal }) => sourceOrdinal)

    expect(new Set(ids).size).toBe(100)
    expect(new Set(ordinals).size).toBe(100)
    expect(ordinals).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1),
    )
    expect(ids.every(isCanonicalValueId)).toBe(true)
  })

  it("keeps every static record immutable", () => {
    expect(Object.isFrozen(CANONICAL_VALUES)).toBe(true)
    expect(CANONICAL_VALUES.every(Object.isFrozen)).toBe(true)
  })

  it("retrieves canonical records by their semantic identity", () => {
    const curiosityId = createCanonicalValueId("pvcs-2011:curiosity")

    expect(getCanonicalValueById(curiosityId)).toMatchObject({
      sourceOrdinal: 23,
      englishName: "Curiosity",
      sourceDefinition: "to seek out, experience, and learn new things",
    })
  })

  it("does not silently insert examples or historical labels", () => {
    const englishNames = new Set(
      CANONICAL_VALUES.map(({ englishName }) => englishName),
    )

    expect(englishNames).not.toContain("Ingenuity")
    expect(englishNames).not.toContain("Destiny")
    expect(englishNames).not.toContain("Pets")
    expect(englishNames).not.toContain("Change")
    expect(englishNames).not.toContain("Helpfulness")
  })
})

describe("value identity construction", () => {
  it("accepts only canonical semantic IDs", () => {
    expect(createCanonicalValueId("pvcs-2011:self-knowledge")).toBe(
      "pvcs-2011:self-knowledge",
    )
    expect(() => createCanonicalValueId("pvcs-2001:self-knowledge")).toThrow(
      "Invalid canonical value ID",
    )
  })

  it("accepts only namespaced UUID identities for Custom Values", () => {
    const id = "custom:123e4567-e89b-42d3-a456-426614174000"

    expect(isCustomValueId(id)).toBe(true)
    expect(createCustomValueId(id)).toBe(id)
    expect(() => createCustomValueId("custom:ingenuity")).toThrow(
      "Invalid Custom Value ID",
    )
  })
})
