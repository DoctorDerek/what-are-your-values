import {
  createActiveDeck,
  getPairCount,
  type ActiveDeck,
} from "@game/data/src/ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
  type CustomValueId,
  type ValueId,
  type ValuePair,
} from "@game/data/src/Value"
import { describe, expect, it } from "vitest"
import {
  advanceJoinPassCursor,
  createJoinPassRestorePoint,
  getJoinPassPairCount,
  projectJoinPassPair,
  type JoinPassRestorePoint,
} from "./JoinPassScheduler"
import { JOIN_PASS_SCHEDULE_KIND } from "./SchedulerIdentity"

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

function getCustomValueIds(activeDeck: ActiveDeck) {
  return activeDeck.customValues.map(({ id }) => id)
}

function createRestorePoint(
  activeDeck: ActiveDeck,
  joinedValueIds: readonly CustomValueId[],
  cursor = 0,
  overrides: Partial<
    Pick<
      JoinPassRestorePoint,
      "progressGeneration" | "deckRevision" | "seed" | "cycleIndex"
    >
  > = {},
) {
  return createJoinPassRestorePoint({
    activeDeck,
    joinedValueIds,
    progressGeneration: 3,
    deckRevision: 5,
    seed: "join-pass-invariant-seed",
    cycleIndex: 2,
    cursor,
    ...overrides,
  })
}

function collectJoinPass(
  activeDeck: ActiveDeck,
  joinedValueIds: readonly CustomValueId[],
  overrides: Parameters<typeof createRestorePoint>[3] = {},
) {
  const pairCount = getJoinPassPairCount(
    activeDeck.valueIds.length,
    joinedValueIds.length,
  )

  return Array.from({ length: pairCount }, (_, cursor) =>
    projectJoinPassPair(
      activeDeck,
      createRestorePoint(activeDeck, joinedValueIds, cursor, overrides),
    ),
  )
}

function createUnorderedPairKey(pair: ValuePair) {
  return [...pair].sort().join("|")
}

function pairsShareValue(first: ValuePair, second: ValuePair) {
  return first.some((valueId) => second.includes(valueId))
}

function createExpectedJoinPairKeys(
  activeDeck: ActiveDeck,
  joinedValueIds: readonly CustomValueId[],
) {
  const joinedValueIdSet = new Set<ValueId>(joinedValueIds)
  const pairKeys = new Set<string>()

  activeDeck.valueIds.forEach((firstValueId, firstIndex) => {
    activeDeck.valueIds.slice(firstIndex + 1).forEach((secondValueId) => {
      if (
        joinedValueIdSet.has(firstValueId) ||
        joinedValueIdSet.has(secondValueId)
      ) {
        pairKeys.add(createUnorderedPairKey([firstValueId, secondValueId]))
      }
    })
  })

  return pairKeys
}

describe("Join Pass pair count", () => {
  it.each([
    [101, 1, 100],
    [102, 2, 201],
    [103, 3, 303],
    [1_100, 1_000, 599_500],
  ])(
    "derives N=%i and K=%i as %i Join Pass pairs",
    (activeValueCount, joinedValueCount, expectedPairCount) => {
      expect(getJoinPassPairCount(activeValueCount, joinedValueCount)).toBe(
        expectedPairCount,
      )
    },
  )

  it("rejects invalid and unsafe cardinalities", () => {
    expect(() => getJoinPassPairCount(1, 1)).toThrow(
      "Invalid active value count",
    )
    expect(() => getJoinPassPairCount(100, 0)).toThrow(
      "Invalid joined value count",
    )
    expect(() => getJoinPassPairCount(100, 101)).toThrow(
      "Invalid joined value count",
    )
    expect(() => getJoinPassPairCount(100.5, 1)).toThrow(
      "Invalid active value count",
    )
    expect(() =>
      getJoinPassPairCount(
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
      ),
    ).toThrow("Unsafe Join Pass pair count")
  })
})

describe("Join Pass construction", () => {
  it("canonicalizes joined and retained membership to Active Deck order", () => {
    const activeDeck = createDeck(3)
    const [first, second, third] = getCustomValueIds(activeDeck)
    const restorePoint = createRestorePoint(activeDeck, [third, first])

    expect(restorePoint.scheduleKind).toBe(JOIN_PASS_SCHEDULE_KIND)
    expect(restorePoint.joinedValueIds).toEqual([first, third])
    expect(restorePoint.retainedValueIds).toEqual(
      activeDeck.valueIds.filter(
        (valueId) => valueId !== first && valueId !== third,
      ),
    )
    expect(restorePoint.retainedValueIds).toContain(second)
    expect(restorePoint.pairCount).toBe(203)
    expect(restorePoint).not.toHaveProperty("pairs")
    expect(Object.isFrozen(restorePoint)).toBe(true)
    expect(Object.isFrozen(restorePoint.joinedValueIds)).toBe(true)
    expect(Object.isFrozen(restorePoint.retainedValueIds)).toBe(true)
  })

  it("supports large finite joined sets with only O(N + K) durable state", () => {
    const activeDeck = createDeck(1_000)
    const joinedValueIds = getCustomValueIds(activeDeck)
    const restorePoint = createRestorePoint(activeDeck, joinedValueIds)

    expect(restorePoint.retainedValueIds).toHaveLength(100)
    expect(restorePoint.joinedValueIds).toHaveLength(1_000)
    expect(restorePoint.pairCount).toBe(599_500)
    expect(restorePoint).not.toHaveProperty("pairs")
  })
})

describe("Join Pass coverage", () => {
  it.each([1, 2, 3, 4])(
    "covers every K=%i joined pair exactly once",
    (joinedValueCount) => {
      const activeDeck = createDeck(joinedValueCount)
      const joinedValueIds = getCustomValueIds(activeDeck)
      const projections = collectJoinPass(activeDeck, joinedValueIds)
      const pairKeys = projections.map(({ pair }) =>
        createUnorderedPairKey(pair),
      )
      const expectedPairKeys = createExpectedJoinPairKeys(
        activeDeck,
        joinedValueIds,
      )

      expect(projections).toHaveLength(
        getJoinPassPairCount(activeDeck.valueIds.length, joinedValueCount),
      )
      expect(new Set(pairKeys)).toEqual(expectedPairKeys)
      expect(pairKeys).toHaveLength(expectedPairKeys.size)
      expect(projections.every(({ pair: [first, second] }) => first !== second))
        .toBe(true)
    },
  )

  it.each([1, 2, 3])(
    "partitions K=%i join pairs from retained-only pairs into the full deck",
    (joinedValueCount) => {
      const activeDeck = createDeck(joinedValueCount)
      const retainedValueCount =
        activeDeck.valueIds.length - joinedValueCount

      expect(
        getJoinPassPairCount(activeDeck.valueIds.length, joinedValueCount) +
          getPairCount(retainedValueCount),
      ).toBe(getPairCount(activeDeck.valueIds.length))
    },
  )

  it("labels exact joined-retained and joined-joined cardinalities", () => {
    const activeDeck = createDeck(4)
    const joinedValueIds = getCustomValueIds(activeDeck)
    const projections = collectJoinPass(activeDeck, joinedValueIds)

    expect(
      projections.filter(({ pairKind }) => pairKind === "joined-retained"),
    ).toHaveLength(400)
    expect(
      projections.filter(({ pairKind }) => pairKind === "joined-joined"),
    ).toHaveLength(6)
  })

  it("spaces K=3 joined-retained evidence without immediate repetition", () => {
    const activeDeck = createDeck(3)
    const joinedValueIds = getCustomValueIds(activeDeck)
    const crossPairCount = joinedValueIds.length * 100
    const crossPairs = collectJoinPass(activeDeck, joinedValueIds)
      .slice(0, crossPairCount)
      .map(({ pair }) => pair)

    for (let cursor = 1; cursor < crossPairs.length; cursor += 1) {
      expect(pairsShareValue(crossPairs[cursor - 1], crossPairs[cursor])).toBe(
        false,
      )
    }
  })

  it("uses each joined value at most once per joined-only round", () => {
    const activeDeck = createDeck(6)
    const joinedValueIds = getCustomValueIds(activeDeck)
    const joinedPairs = collectJoinPass(activeDeck, joinedValueIds)
      .filter(({ pairKind }) => pairKind === "joined-joined")
      .map(({ pair }) => pair)
    const matchesPerRound = joinedValueIds.length / 2

    for (
      let cursor = 0;
      cursor < joinedPairs.length;
      cursor += matchesPerRound
    ) {
      const roundPairs = joinedPairs.slice(cursor, cursor + matchesPerRound)
      expect(new Set(roundPairs.flat()).size).toBe(roundPairs.length * 2)
    }
  })
})

describe("Join Pass reconstruction", () => {
  it("reconstructs the same pair from the same durable identity and cursor", () => {
    const activeDeck = createDeck(3)
    const joinedValueIds = getCustomValueIds(activeDeck)
    const restorePoint = createRestorePoint(activeDeck, joinedValueIds, 202)

    expect(projectJoinPassPair(activeDeck, restorePoint)).toEqual(
      projectJoinPassPair(activeDeck, { ...restorePoint }),
    )
  })

  it("uses seed, progress generation, and deck revision as schedule inputs", () => {
    const activeDeck = createDeck(3)
    const joinedValueIds = getCustomValueIds(activeDeck)
    const collectFirstPairs = (
      overrides: Parameters<typeof createRestorePoint>[3],
    ) =>
      Array.from({ length: 20 }, (_, cursor) =>
        projectJoinPassPair(
          activeDeck,
          createRestorePoint(activeDeck, joinedValueIds, cursor, overrides),
        ).pair,
      )

    const baseline = collectFirstPairs({})
    expect(collectFirstPairs({ seed: "different-seed" })).not.toEqual(baseline)
    expect(collectFirstPairs({ progressGeneration: 4 })).not.toEqual(baseline)
    expect(collectFirstPairs({ deckRevision: 6 })).not.toEqual(baseline)
  })

  it("advances within the pass and signals its exact boundary", () => {
    const activeDeck = createDeck(1)
    const joinedValueIds = getCustomValueIds(activeDeck)
    const initialRestorePoint = createRestorePoint(activeDeck, joinedValueIds)
    const finalRestorePoint = createRestorePoint(
      activeDeck,
      joinedValueIds,
      initialRestorePoint.pairCount - 1,
    )

    expect(
      advanceJoinPassCursor(activeDeck, initialRestorePoint)?.cursor,
    ).toBe(1)
    expect(advanceJoinPassCursor(activeDeck, finalRestorePoint)).toBeNull()
  })
})

describe("Join Pass restore validation", () => {
  it("rejects mismatched membership, counts, fingerprints, and cursors", () => {
    const activeDeck = createDeck(2)
    const joinedValueIds = getCustomValueIds(activeDeck)
    const restorePoint = createRestorePoint(activeDeck, joinedValueIds)
    const changedDeck = createDeck(3)
    const duplicatedJoinedValues = [
      joinedValueIds[0],
      joinedValueIds[0],
    ] as const
    const alteredRetainedValues = {
      ...restorePoint,
      retainedValueIds: restorePoint.retainedValueIds.slice(1),
    }
    const alteredPairCount = {
      ...restorePoint,
      pairCount: restorePoint.pairCount + 1,
    }

    expect(() => createRestorePoint(activeDeck, duplicatedJoinedValues)).toThrow(
      "duplicate joined Value IDs",
    )
    expect(() =>
      createJoinPassRestorePoint({
        activeDeck,
        joinedValueIds: [activeDeck.valueIds[0] as CustomValueId],
        progressGeneration: 0,
        deckRevision: 0,
        seed: "invalid-membership",
        cycleIndex: 0,
      }),
    ).toThrow("joined IDs must be Custom Value IDs")
    expect(() =>
      projectJoinPassPair(changedDeck, restorePoint),
    ).toThrow("fingerprint does not match")
    expect(() =>
      projectJoinPassPair(
        activeDeck,
        alteredRetainedValues as JoinPassRestorePoint,
      ),
    ).toThrow("retained Value IDs do not match")
    expect(() =>
      projectJoinPassPair(
        activeDeck,
        alteredPairCount as JoinPassRestorePoint,
      ),
    ).toThrow("Invalid Join Pass pair count")
    expect(() =>
      createRestorePoint(activeDeck, joinedValueIds, restorePoint.pairCount),
    ).toThrow("Invalid scheduler cursor")
  })
})
