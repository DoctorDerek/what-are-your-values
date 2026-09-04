import { CANONICAL_VALUES } from "@game/data/src/CanonicalValues"
import {
  createCanonicalValueId,
  createCustomValueId,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import { VALUE_TO_ANIMAL_MAP } from "@game/data/src/ValueToAnimalMap"
import { ZOO_ANIMALS } from "@game/data/src/ZooAnimals"
import { describe, expect, it } from "vitest"
import {
  resolveSeethingSwarmBattleCombatant,
  SEETHING_SWARM_CUSTOM_VALUE_ANIMAL_ASSOCIATION_VERSION,
  SEETHING_SWARM_CUSTOM_VALUE_ANIMAL_ROSTER,
} from "./SeethingSwarmBattleCombatant"

const FIXED_CUSTOM_ASSOCIATIONS = Object.freeze([
  Object.freeze({
    valueId: createCustomValueId("custom:00000000-0000-4000-8000-000000000000"),
    animalId: "pandapack",
  }),
  Object.freeze({
    valueId: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
    animalId: "frogpack",
  }),
  Object.freeze({
    valueId: createCustomValueId("custom:00000000-0000-4000-8000-000000abcdef"),
    animalId: "lildoggies/lildoggie01_brown",
  }),
])

function createIndexedCustomValueId(index: number) {
  return createCustomValueId(
    `custom:00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
  )
}

describe("SeethingSwarm battle combatants", () => {
  it("reuses every frozen canonical value association exactly", () => {
    const combatants = CANONICAL_VALUES.map(({ id }) =>
      resolveSeethingSwarmBattleCombatant(id),
    )

    expect(combatants).toEqual(VALUE_TO_ANIMAL_MAP)
    expect(combatants.every(Object.isFrozen)).toBe(true)
  })

  it("locks the versioned Custom Value roster to all original animals", () => {
    expect(SEETHING_SWARM_CUSTOM_VALUE_ANIMAL_ASSOCIATION_VERSION).toBe(1)
    expect(SEETHING_SWARM_CUSTOM_VALUE_ANIMAL_ROSTER).toEqual(
      ZOO_ANIMALS.map(({ id }) => id),
    )
    expect(SEETHING_SWARM_CUSTOM_VALUE_ANIMAL_ROSTER).toHaveLength(45)
    expect(new Set(SEETHING_SWARM_CUSTOM_VALUE_ANIMAL_ROSTER).size).toBe(45)
    expect(Object.isFrozen(SEETHING_SWARM_CUSTOM_VALUE_ANIMAL_ROSTER)).toBe(
      true,
    )
  })

  it("preserves fixed Custom Value associations across implementations", () => {
    expect(
      FIXED_CUSTOM_ASSOCIATIONS.map(({ valueId }) =>
        resolveSeethingSwarmBattleCombatant(valueId),
      ),
    ).toEqual(FIXED_CUSTOM_ASSOCIATIONS)
  })

  it("uses opaque identity without reading private names or definitions", () => {
    const id = createCustomValueId(
      "custom:12345678-1234-4234-9234-123456789abc",
    )
    const original = Object.freeze({
      kind: "custom",
      id,
      name: "Private original name",
      definition: "Private original definition",
      creationOrdinal: 1,
      createdAt: "2026-09-03T00:00:00.000Z",
      updatedAt: "2026-09-03T00:00:00.000Z",
    }) satisfies CustomValueDefinition
    const renamed = Object.freeze({
      ...original,
      name: "Entirely different private name",
      definition: "Entirely different private definition",
      updatedAt: "2026-09-04T00:00:00.000Z",
    }) satisfies CustomValueDefinition

    expect(resolveSeethingSwarmBattleCombatant(original.id)).toEqual(
      resolveSeethingSwarmBattleCombatant(renamed.id),
    )
  })

  it("makes every roster animal reachable from valid Custom Value IDs", () => {
    const reachableAnimalIds = new Set(
      Array.from({ length: 4_096 }, (_, index) =>
        resolveSeethingSwarmBattleCombatant(createIndexedCustomValueId(index)),
      ).map(({ animalId }) => animalId),
    )

    expect([...reachableAnimalIds].toSorted()).toEqual(
      [...SEETHING_SWARM_CUSTOM_VALUE_ANIMAL_ROSTER].toSorted(),
    )
  })

  it("fails loudly for an unmapped canonical value identity", () => {
    expect(() =>
      resolveSeethingSwarmBattleCombatant(
        createCanonicalValueId("pvcs-2011:unmapped"),
      ),
    ).toThrow("Missing animal mapping for canonical value: pvcs-2011:unmapped")
  })
})
