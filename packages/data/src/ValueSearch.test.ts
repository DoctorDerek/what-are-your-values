import { describe, expect, it } from "vitest"
import { createActiveDeck } from "./ActiveDeck"
import { createCustomValueId, type CustomValueDefinition } from "./Value"
import { createInitialValueProgress } from "./ValueProgress"
import { rankValues } from "./ValueRanking"
import {
  filterRankedValuesByQuery,
  findRankedValueNameMatches,
  hasExactRankedValueNameCollision,
} from "./ValueSearch"

const ingenuityId = createCustomValueId(
  "custom:00000000-0000-4000-8000-000000000001",
)

const ingenuity = Object.freeze({
  kind: "custom",
  id: ingenuityId,
  name: "Ingenuity",
  definition: "To solve problems in original and resourceful ways.",
  creationOrdinal: 1,
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
}) satisfies CustomValueDefinition

function createRankedValues() {
  const activeDeck = createActiveDeck([ingenuity])
  return rankValues(activeDeck, createInitialValueProgress(activeDeck))
}

describe("Value Search", () => {
  it("preserves the supplied ranking when the query is empty", () => {
    const rankedValues = createRankedValues()

    expect(filterRankedValuesByQuery(rankedValues, "   ")).toBe(rankedValues)
  })

  it("matches literal names and definition text without semantic inference", () => {
    const rankedValues = createRankedValues()

    expect(
      findRankedValueNameMatches(rankedValues, "ingen").map(
        ({ definition }) => definition.id,
      ),
    ).toEqual([ingenuityId])
    expect(
      filterRankedValuesByQuery(rankedValues, "resourceful").map(
        ({ definition }) => definition.id,
      ),
    ).toEqual([ingenuityId])
    expect(filterRankedValuesByQuery(rankedValues, "inventiveness")).toEqual([])
  })

  it("returns no partial suggestions for an empty proposed name", () => {
    expect(findRankedValueNameMatches(createRankedValues(), " ")).toEqual([])
  })

  it("detects normalized exact collisions while excluding the edited value", () => {
    const rankedValues = createRankedValues()

    expect(
      hasExactRankedValueNameCollision({
        rankedValues,
        name: "  ＩＮＧＥＮＵＩＴＹ  ",
      }),
    ).toBe(true)
    expect(
      hasExactRankedValueNameCollision({
        rankedValues,
        name: "Ingenuity",
        excludedValueId: ingenuityId,
      }),
    ).toBe(false)
    expect(
      hasExactRankedValueNameCollision({
        rankedValues,
        name: "Ingeniousness",
      }),
    ).toBe(false)
  })
})
