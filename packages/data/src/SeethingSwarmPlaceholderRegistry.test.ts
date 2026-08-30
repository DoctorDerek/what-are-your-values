import { describe, expect, it } from "vitest"
import type { SeethingSwarmPublicFallbackRegistry } from "./SeethingSwarmAnimalRegistry"
import {
  SEETHING_SWARM_PLACEHOLDER_REGISTRY,
  SEETHING_SWARM_PUBLIC_PLACEHOLDER_ID,
} from "./SeethingSwarmPlaceholderRegistry"
import { ZOO_ANIMALS } from "./ZooAnimals"

function acceptPublicFallbackRegistry(
  registry: SeethingSwarmPublicFallbackRegistry,
) {
  return registry
}

describe("SeethingSwarm placeholder registry", () => {
  it("covers every stable animal identity once in canonical order", () => {
    const animalIds = SEETHING_SWARM_PLACEHOLDER_REGISTRY.animals.map(
      ({ animalId }) => animalId,
    )

    expect(animalIds).toEqual(ZOO_ANIMALS.map(({ id }) => id))
    expect(animalIds).toHaveLength(45)
    expect(new Set(animalIds).size).toBe(animalIds.length)
  })

  it("uses one neutral original placeholder treatment", () => {
    const placeholderIds = SEETHING_SWARM_PLACEHOLDER_REGISTRY.animals.map(
      ({ placeholderId }) => placeholderId,
    )

    expect(SEETHING_SWARM_PUBLIC_PLACEHOLDER_ID).toBe(
      "original-neutral-animal-placeholder",
    )
    expect(new Set(placeholderIds)).toEqual(
      new Set([SEETHING_SWARM_PUBLIC_PLACEHOLDER_ID]),
    )
  })

  it("exposes only identity and placeholder fields", () => {
    for (const entry of SEETHING_SWARM_PLACEHOLDER_REGISTRY.animals) {
      expect(Object.keys(entry).sort()).toEqual(["animalId", "placeholderId"])
    }
  })

  it("never invents licensed asset or animation availability", () => {
    const serializedRegistry = JSON.stringify(
      SEETHING_SWARM_PLACEHOLDER_REGISTRY,
    )

    expect(serializedRegistry).not.toContain(".png")
    expect(serializedRegistry).not.toContain("spritesheet")
    expect(serializedRegistry).not.toMatch(
      /animation|palette|color|reaction|family|source/i,
    )
  })

  it("deeply freezes the public fallback registry", () => {
    expect(Object.isFrozen(SEETHING_SWARM_PLACEHOLDER_REGISTRY)).toBe(true)
    expect(Object.isFrozen(SEETHING_SWARM_PLACEHOLDER_REGISTRY.animals)).toBe(
      true,
    )
    expect(
      SEETHING_SWARM_PLACEHOLDER_REGISTRY.animals.every(Object.isFrozen),
    ).toBe(true)
  })

  it("satisfies the collection-level public fallback contract", () => {
    expect(
      acceptPublicFallbackRegistry(SEETHING_SWARM_PLACEHOLDER_REGISTRY),
    ).toBe(SEETHING_SWARM_PLACEHOLDER_REGISTRY)
  })
})
