import { createActiveDeck, getPairCount } from "@game/data/src/ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
  type ValuePair,
} from "@game/data/src/Value"
import { describe, expect, it } from "vitest"
import {
  advanceDeckReconfigurationCursor,
  createDeckReconfigurationRestorePoint,
  projectDeckReconfigurationPair,
  type DeckReconfigurationRestorePoint,
} from "./DeckReconfigurationScheduler"

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

function createDeck(customValueCount: number) {
  return createActiveDeck(
    Array.from({ length: customValueCount }, (_, index) =>
      createCustomValue(index + 1),
    ),
  )
}

function createRestorePoint(customValueCount: number, cursor = 0) {
  const activeDeck = createDeck(customValueCount)
  const joinedValueIds = activeDeck.customValues.map(({ id }) => id)

  return {
    activeDeck,
    restorePoint: createDeckReconfigurationRestorePoint({
      activeDeck,
      joinedValueIds,
      progressGeneration: 2,
      deckRevision: 4,
      seed: "deck-reconfiguration-invariant-seed",
      cycleIndex: 0,
      cursor,
    }),
  }
}

function collectRevisedCycle(customValueCount: number) {
  const { activeDeck, restorePoint } = createRestorePoint(customValueCount)

  return {
    activeDeck,
    restorePoint,
    projections: Array.from({ length: restorePoint.pairCount }, (_, cursor) =>
      projectDeckReconfigurationPair(
        activeDeck,
        createDeckReconfigurationRestorePoint({
          activeDeck,
          joinedValueIds: restorePoint.joinedValueIds,
          progressGeneration: restorePoint.progressGeneration,
          deckRevision: restorePoint.deckRevision,
          seed: restorePoint.seed,
          cycleIndex: restorePoint.cycleIndex,
          cursor,
        }),
      ),
    ),
  }
}

function createUnorderedPairKey(pair: ValuePair) {
  return [...pair].sort().join("|")
}

describe("Deck-reconfiguration scheduler", () => {
  it.each([
    [1, 100, 4_950, 5_050],
    [2, 201, 4_950, 5_151],
    [3, 303, 4_950, 5_253],
  ])(
    "partitions K=%i into %i join, %i retained, and %i total pairs",
    (customValueCount, joinPairCount, retainedPairCount, pairCount) => {
      const { activeDeck, restorePoint } = createRestorePoint(customValueCount)

      expect(restorePoint.joinPairCount).toBe(joinPairCount)
      expect(restorePoint.retainedPairCount).toBe(retainedPairCount)
      expect(restorePoint.pairCount).toBe(pairCount)
      expect(restorePoint.pairCount).toBe(
        getPairCount(activeDeck.valueIds.length),
      )
      expect(restorePoint).not.toHaveProperty("pairs")
    },
  )

  it.each([1, 2, 3])(
    "covers every revised K=%i deck pair exactly once",
    (customValueCount) => {
      const { activeDeck, restorePoint, projections } =
        collectRevisedCycle(customValueCount)
      const pairKeys = projections.map(({ pair }) =>
        createUnorderedPairKey(pair),
      )

      expect(pairKeys).toHaveLength(getPairCount(activeDeck.valueIds.length))
      expect(new Set(pairKeys).size).toBe(pairKeys.length)
      expect(
        projections.filter(({ pairKind }) => pairKind !== "retained-retained"),
      ).toHaveLength(restorePoint.joinPairCount)
      expect(
        projections.filter(({ pairKind }) => pairKind === "retained-retained"),
      ).toHaveLength(restorePoint.retainedPairCount)
    },
  )

  it("spaces a single joined value through retained-only evidence", () => {
    const { restorePoint, projections } = collectRevisedCycle(1)
    const joinedValueId = restorePoint.joinedValueIds[0]
    const earlyProjections = projections.slice(
      0,
      restorePoint.joinPairCount * 2,
    )

    expect(
      earlyProjections.filter(({ pair }) => pair.includes(joinedValueId)),
    ).toHaveLength(restorePoint.joinPairCount)
    for (let cursor = 1; cursor < earlyProjections.length; cursor += 1) {
      expect(
        earlyProjections[cursor - 1].pair.includes(joinedValueId) &&
          earlyProjections[cursor].pair.includes(joinedValueId),
      ).toBe(false)
    }
  })

  it("reconstructs exactly and signals the complete revised-cycle boundary", () => {
    const { activeDeck, restorePoint } = createRestorePoint(2, 2_024)
    const finalRestorePoint = createDeckReconfigurationRestorePoint({
      activeDeck,
      joinedValueIds: restorePoint.joinedValueIds,
      progressGeneration: restorePoint.progressGeneration,
      deckRevision: restorePoint.deckRevision,
      seed: restorePoint.seed,
      cycleIndex: restorePoint.cycleIndex,
      cursor: restorePoint.pairCount - 1,
    })

    expect(projectDeckReconfigurationPair(activeDeck, restorePoint)).toEqual(
      projectDeckReconfigurationPair(activeDeck, {
        ...restorePoint,
      }),
    )
    expect(
      advanceDeckReconfigurationCursor(activeDeck, restorePoint)?.cursor,
    ).toBe(2_025)
    expect(
      advanceDeckReconfigurationCursor(activeDeck, finalRestorePoint),
    ).toBeNull()
  })

  it("rejects corrupted partition state", () => {
    const { activeDeck, restorePoint } = createRestorePoint(1)
    const corruptedRestorePoint = {
      ...restorePoint,
      joinPairCount: restorePoint.joinPairCount + 1,
    } as DeckReconfigurationRestorePoint

    expect(() =>
      projectDeckReconfigurationPair(activeDeck, corruptedRestorePoint),
    ).toThrow("Invalid deck-reconfiguration join pair count")

    expect(() =>
      projectDeckReconfigurationPair(activeDeck, {
        ...restorePoint,
        retainedPairCount: restorePoint.retainedPairCount + 1,
      } as DeckReconfigurationRestorePoint),
    ).toThrow("Invalid deck-reconfiguration retained pair count")
    expect(() =>
      projectDeckReconfigurationPair(activeDeck, {
        ...restorePoint,
        pairCount: restorePoint.pairCount + 1,
      } as DeckReconfigurationRestorePoint),
    ).toThrow("Invalid deck-reconfiguration pair count")
    expect(() =>
      projectDeckReconfigurationPair(activeDeck, {
        ...restorePoint,
        retainedValueIds: [...restorePoint.retainedValueIds].reverse(),
      } as DeckReconfigurationRestorePoint),
    ).toThrow("retained IDs do not match the Join Pass")

    const twoJoinedValues = createRestorePoint(2)
    const reversedJoinedValues = {
      ...twoJoinedValues.restorePoint,
      joinedValueIds: [
        ...twoJoinedValues.restorePoint.joinedValueIds,
      ].reverse(),
    } as DeckReconfigurationRestorePoint

    expect(() =>
      projectDeckReconfigurationPair(
        twoJoinedValues.activeDeck,
        reversedJoinedValues,
      ),
    ).toThrow("joined IDs do not match the Join Pass")
  })
})
