import { describe, expect, it } from "vitest"
import { createActiveDeck } from "./ActiveDeck"
import { projectAllValues } from "./AllValuesProjection"
import { createCustomValueId, type CustomValueDefinition } from "./Value"
import {
  createInitialValueProgress,
  createValueProgressById,
} from "./ValueProgress"
import { rankValues } from "./ValueRanking"

const INGENUITY = Object.freeze({
  kind: "custom",
  id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
  name: "Ingenuity",
  definition: "To solve problems in original and resourceful ways.",
  creationOrdinal: 1,
  createdAt: "2026-08-08T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
}) satisfies CustomValueDefinition

describe("All Values Projection", () => {
  it("orders an unplayed deck alphabetically without inventing ranks", () => {
    const activeDeck = createActiveDeck([INGENUITY])
    const projection = projectAllValues({
      rankedValues: rankValues(
        activeDeck,
        createInitialValueProgress(activeDeck),
      ),
      searchQuery: "",
    })

    expect(projection.hasComparisons).toBe(false)
    expect(projection.orderedValues[0]?.definition.englishName).toBe(
      "Acceptance",
    )
    expect(projection.existingCustomValues).toEqual([INGENUITY])
  })

  it("preserves evidence order while filtering names and definitions", () => {
    const activeDeck = createActiveDeck([INGENUITY])
    const [firstValueId] = activeDeck.valueIds
    const progressById = createValueProgressById(
      activeDeck,
      activeDeck.valueIds.map((valueId) => [
        valueId,
        valueId === firstValueId
          ? {
              totalXp: 20,
              profileWins: 1,
              profileComparisons: 1,
              currentCycleWins: 1,
            }
          : {
              totalXp: 0,
              profileWins: 0,
              profileComparisons: 0,
              currentCycleWins: 0,
            },
      ]),
    )
    const rankedValues = rankValues(activeDeck, progressById)
    const projection = projectAllValues({
      rankedValues,
      searchQuery: "resourceful",
    })

    expect(projection.hasComparisons).toBe(true)
    expect(projection.orderedValues).toBe(rankedValues)
    expect(
      projection.visibleValues.map(({ definition }) => definition.id),
    ).toEqual([INGENUITY.id])
  })

  it("returns frozen platform-neutral collections", () => {
    const activeDeck = createActiveDeck([INGENUITY])
    const projection = projectAllValues({
      rankedValues: rankValues(
        activeDeck,
        createInitialValueProgress(activeDeck),
      ),
      searchQuery: "",
    })

    expect(Object.isFrozen(projection)).toBe(true)
    expect(Object.isFrozen(projection.orderedValues)).toBe(true)
    expect(Object.isFrozen(projection.visibleValues)).toBe(true)
    expect(Object.isFrozen(projection.existingCustomValues)).toBe(true)
  })
})
