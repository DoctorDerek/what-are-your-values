import { describe, expect, it } from "vitest"
import { createActiveDeck } from "./ActiveDeck"
import { projectHubValues } from "./HubValueProjection"
import { getValueDisplayName } from "./Value"
import {
  createInitialValueProgress,
  type ValueProgressById,
} from "./ValueProgress"
import { rankValues } from "./ValueRanking"

function recordComparison(progressById: ValueProgressById) {
  const comparedValueIds = Array.from(progressById.keys()).slice(0, 2)

  return new Map(
    Array.from(progressById, ([valueId, progress]) => [
      valueId,
      comparedValueIds.includes(valueId)
        ? { ...progress, profileComparisons: 1 }
        : progress,
    ]),
  ) satisfies ValueProgressById
}

describe("Hub Value Projection", () => {
  it("shows the complete unplayed deck alphabetically without changing ranks", () => {
    const activeDeck = createActiveDeck([])
    const rankedValues = rankValues(
      activeDeck,
      createInitialValueProgress(activeDeck),
    )
    const originalRankByValueId = new Map(
      rankedValues.map(({ definition, rank }) => [definition.id, rank]),
    )

    const projection = projectHubValues(rankedValues)

    expect(projection.hasComparisons).toBe(false)
    expect(projection.visibleValues).toHaveLength(100)
    expect(
      projection.visibleValues
        .slice(0, 3)
        .map(({ definition }) => getValueDisplayName(definition)),
    ).toEqual(["Acceptance", "Accuracy", "Achievement"])
    expect(
      projection.visibleValues.every(
        ({ definition, rank }) =>
          originalRankByValueId.get(definition.id) === rank,
      ),
    ).toBe(true)
  })

  it("preserves evidence order and separates the Top Five after a comparison", () => {
    const activeDeck = createActiveDeck([])
    const rankedValues = rankValues(
      activeDeck,
      recordComparison(createInitialValueProgress(activeDeck)),
    )

    const projection = projectHubValues(rankedValues)

    expect(projection.hasComparisons).toBe(true)
    expect(projection.visibleValues).toEqual(rankedValues)
    expect(projection.topFive).toEqual(rankedValues.slice(0, 5))
    expect(projection.remainingValues).toEqual(rankedValues.slice(5))
    expect(Object.isFrozen(projection)).toBe(true)
    expect(Object.isFrozen(projection.visibleValues)).toBe(true)
    expect(Object.isFrozen(projection.topFive)).toBe(true)
    expect(Object.isFrozen(projection.remainingValues)).toBe(true)
  })
})
