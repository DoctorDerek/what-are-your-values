import { describe, expect, it } from "vitest"
import { createActiveDeck } from "./ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
  type ValueId,
} from "./Value"
import {
  createInitialValueProgress,
  type ValueProgress,
  type ValueProgressById,
} from "./ValueProgress"
import { rankValues, sortRankedValuesAlphabetically } from "./ValueRanking"

function createCustomValue(creationOrdinal: number): CustomValueDefinition {
  const uuidSuffix = creationOrdinal.toString().padStart(12, "0")

  return {
    kind: "custom",
    id: createCustomValueId(`custom:00000000-0000-4000-8000-${uuidSuffix}`),
    name: `Custom Value ${creationOrdinal}`,
    definition: `Definition ${creationOrdinal}`,
    creationOrdinal,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
  }
}

function createProgress(
  totalXp: number,
  profileWins: number,
  profileComparisons: number,
  currentCycleWins: number,
): ValueProgress {
  return {
    totalXp,
    profileWins,
    profileComparisons,
    currentCycleWins,
  }
}

function setProgress(
  progressById: ValueProgressById,
  valueId: ValueId,
  progress: ValueProgress,
) {
  return new Map(progressById).set(valueId, progress)
}

describe("Value Ranking", () => {
  it("orders evidence by XP, current-cycle wins, then profile wins", () => {
    const activeDeck = createActiveDeck([])
    const [first, second, third, fourth] = activeDeck.valueIds
    const progressById = setProgress(
      setProgress(
        setProgress(
          setProgress(
            createInitialValueProgress(activeDeck),
            first,
            createProgress(20, 8, 12, 2),
          ),
          second,
          createProgress(20, 7, 12, 3),
        ),
        third,
        createProgress(20, 9, 13, 3),
      ),
      fourth,
      createProgress(21, 6, 10, 1),
    )
    const ranking = rankValues(activeDeck, progressById)

    expect(ranking.slice(0, 4).map(({ definition }) => definition.id)).toEqual([
      fourth,
      third,
      second,
      first,
    ])
  })

  it("uses canonical-before-Custom and immutable ordinals only for exact ties", () => {
    const firstCustomValue = createCustomValue(1)
    const secondCustomValue = createCustomValue(2)
    const activeDeck = createActiveDeck([secondCustomValue, firstCustomValue])
    const ranking = rankValues(
      activeDeck,
      createInitialValueProgress(activeDeck),
    )

    expect(ranking.map(({ rank }) => rank)).toEqual(
      Array.from({ length: 102 }, (_, index) => index + 1),
    )
    expect(
      ranking.slice(0, 100).map(({ definition }) => definition.id),
    ).toEqual(activeDeck.valueIds.slice(0, 100))
    expect(ranking.at(100)?.definition.id).toBe(firstCustomValue.id)
    expect(ranking.at(101)?.definition.id).toBe(secondCustomValue.id)
  })

  it("returns immutable projections without mutating deck or progress order", () => {
    const activeDeck = createActiveDeck([createCustomValue(1)])
    const progressById = createInitialValueProgress(activeDeck)
    const originalValueIds = [...activeDeck.valueIds]
    const originalProgressIds = Array.from(progressById.keys())
    const ranking = rankValues(activeDeck, progressById)

    expect(Object.isFrozen(ranking)).toBe(true)
    expect(ranking.every(Object.isFrozen)).toBe(true)
    expect(activeDeck.valueIds).toEqual(originalValueIds)
    expect(Array.from(progressById.keys())).toEqual(originalProgressIds)
  })

  it("sorts an unplayed ranking alphabetically without changing evidence ranks", () => {
    const activeDeck = createActiveDeck([
      createCustomValue(1),
    ])
    const rankedValues = rankValues(
      activeDeck,
      createInitialValueProgress(activeDeck),
    )

    const alphabetizedValues = sortRankedValuesAlphabetically(rankedValues)

    expect(alphabetizedValues[0]?.definition).toMatchObject({
      kind: "canonical",
      englishName: "Acceptance",
    })
    const customValueIndex = alphabetizedValues.findIndex(
      ({ definition }) => definition.kind === "custom",
    )

    expect(alphabetizedValues[customValueIndex]?.definition).toMatchObject({
      kind: "custom",
      name: "Custom Value 1",
    })
    expect(alphabetizedValues[customValueIndex]?.rank).toBe(101)
  })
})
