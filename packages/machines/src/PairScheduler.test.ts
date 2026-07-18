import { createActiveDeck, getPairCount } from "@game/data/src/ActiveDeck"
import {
  createOtherValueId,
  type OtherValueDefinition,
  type ValueId,
  type ValuePair,
} from "@game/data/src/Value"
import { describe, expect, it } from "vitest"
import {
  advanceSchedulerCursor,
  createSchedulerRestorePoint,
  getScheduleShape,
  PAIR_SCHEDULER_ALGORITHM_VERSION,
  projectScheduledPair,
  projectScheduledRound,
  type SchedulerRestorePoint,
} from "./PairScheduler"

function createOtherValue(creationOrdinal: number): OtherValueDefinition {
  const uuidSuffix = creationOrdinal.toString().padStart(12, "0")

  return {
    kind: "other",
    id: createOtherValueId(`custom:00000000-0000-4000-8000-${uuidSuffix}`),
    name: `Other Value ${creationOrdinal}`,
    definition: `Definition ${creationOrdinal}`,
    creationOrdinal,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
  }
}

function createDeck(otherValueCount: number) {
  return createActiveDeck(
    Array.from({ length: otherValueCount }, (_, index) =>
      createOtherValue(index + 1),
    ),
  )
}

function collectCyclePairs(
  activeDeck: ReturnType<typeof createDeck>,
  cycleIndex = 0,
  seed = "scheduler-invariant-seed",
) {
  return Array.from(
    { length: getPairCount(activeDeck.valueIds.length) },
    (_, cursor) =>
      projectScheduledPair(
        activeDeck,
        createSchedulerRestorePoint({
          activeDeck,
          rankingEpoch: 1,
          seed,
          cycleIndex,
          cursor,
        }),
      ).pair,
  )
}

function createUnorderedPairKey(pair: ValuePair) {
  return [...pair].sort().join("|")
}

function pairsShareValue(first: ValuePair, second: ValuePair) {
  return first.some((valueId) => second.includes(valueId))
}

function countAppearances(pairs: readonly ValuePair[]) {
  const appearances = new Map<ValueId, number>()

  pairs.flat().forEach((valueId) => {
    appearances.set(valueId, (appearances.get(valueId) ?? 0) + 1)
  })

  return appearances
}

function countSides(pairs: readonly ValuePair[]) {
  const first = new Map<ValueId, number>()
  const second = new Map<ValueId, number>()

  pairs.forEach(([firstValueId, secondValueId]) => {
    first.set(firstValueId, (first.get(firstValueId) ?? 0) + 1)
    second.set(secondValueId, (second.get(secondValueId) ?? 0) + 1)
  })

  return { first, second }
}

describe("pair scheduler shape", () => {
  it.each([
    [100, 99, 50, 4_950],
    [101, 101, 50, 5_050],
    [102, 101, 51, 5_151],
    [103, 103, 51, 5_253],
  ])(
    "derives %i active values without a cycle-wide pair array",
    (activeValueCount, roundCount, matchesPerRound, pairCount) => {
      expect(getScheduleShape(activeValueCount)).toEqual({
        roundCount,
        matchesPerRound,
        pairCount,
      })
    },
  )

  it("projects only the requested round for a large finite Active Deck", () => {
    const activeDeck = createDeck(1_000)
    const restorePoint = createSchedulerRestorePoint({
      activeDeck,
      rankingEpoch: 7,
      seed: "large-deck-seed",
      cycleIndex: 3,
      cursor: 300_000,
    })
    const scheduledRound = projectScheduledRound(activeDeck, restorePoint)

    expect(activeDeck.valueIds).toHaveLength(1_100)
    expect(scheduledRound.pairs).toHaveLength(550)
    expect(restorePoint).not.toHaveProperty("pairs")
  })
})

describe("pair scheduler coverage", () => {
  it.each([0, 1, 2, 3])(
    "covers every K=%i Active Deck pair exactly once",
    (otherValueCount) => {
      const activeDeck = createDeck(otherValueCount)
      const pairs = collectCyclePairs(activeDeck)
      const uniquePairs = new Set(pairs.map(createUnorderedPairKey))
      const appearances = countAppearances(pairs)

      expect(pairs).toHaveLength(getPairCount(activeDeck.valueIds.length))
      expect(uniquePairs.size).toBe(pairs.length)
      expect(pairs.every(([first, second]) => first !== second)).toBe(true)
      activeDeck.valueIds.forEach((valueId) => {
        expect(appearances.get(valueId)).toBe(activeDeck.valueIds.length - 1)
      })
    },
  )

  it.each([0, 1])(
    "uses each active value at most once per round when K=%i",
    (otherValueCount) => {
      const activeDeck = createDeck(otherValueCount)
      const pairs = collectCyclePairs(activeDeck)
      const { matchesPerRound, roundCount } = getScheduleShape(
        activeDeck.valueIds.length,
      )

      for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
        const roundPairs = pairs.slice(
          roundIndex * matchesPerRound,
          (roundIndex + 1) * matchesPerRound,
        )
        expect(new Set(roundPairs.flat()).size).toBe(roundPairs.length * 2)
      }
    },
  )

  it.each([0, 1])(
    "avoids immediate value repetition at every K=%i round boundary",
    (otherValueCount) => {
      const activeDeck = createDeck(otherValueCount)
      const pairs = collectCyclePairs(activeDeck)
      const { matchesPerRound } = getScheduleShape(activeDeck.valueIds.length)

      for (
        let cursor = matchesPerRound;
        cursor < pairs.length;
        cursor += matchesPerRound
      ) {
        expect(pairsShareValue(pairs[cursor - 1], pairs[cursor])).toBe(false)
      }
    },
  )
})

describe("pair scheduler orientation", () => {
  it("gives every value exact side balance for an odd Active Deck", () => {
    const activeDeck = createDeck(1)
    const sides = countSides(collectCyclePairs(activeDeck))

    activeDeck.valueIds.forEach((valueId) => {
      expect(sides.first.get(valueId)).toBe(50)
      expect(sides.second.get(valueId)).toBe(50)
    })
  })

  it("inverts every even-deck extra side across successive cycles", () => {
    const activeDeck = createDeck(0)
    const firstCycleSides = countSides(collectCyclePairs(activeDeck, 0))
    const secondCycleSides = countSides(collectCyclePairs(activeDeck, 1))

    activeDeck.valueIds.forEach((valueId) => {
      const firstCount = firstCycleSides.first.get(valueId) ?? 0
      const secondCount = firstCycleSides.second.get(valueId) ?? 0

      expect(Math.abs(firstCount - secondCount)).toBe(1)
      expect(secondCycleSides.first.get(valueId)).toBe(secondCount)
      expect(secondCycleSides.second.get(valueId)).toBe(firstCount)
    })
  })
})

describe("pair scheduler reconstruction", () => {
  it("reconstructs the same pair from the same durable identity and cursor", () => {
    const activeDeck = createDeck(2)
    const restorePoint = createSchedulerRestorePoint({
      activeDeck,
      rankingEpoch: 4,
      seed: "reconstruction-seed",
      cycleIndex: 2,
      cursor: 2_024,
    })

    expect(projectScheduledPair(activeDeck, restorePoint)).toEqual(
      projectScheduledPair(activeDeck, { ...restorePoint }),
    )
  })

  it("uses seed and epoch as deterministic schedule inputs", () => {
    const activeDeck = createDeck(0)
    const createFirstRound = (rankingEpoch: number, seed: string) =>
      projectScheduledRound(
        activeDeck,
        createSchedulerRestorePoint({
          activeDeck,
          rankingEpoch,
          seed,
          cycleIndex: 0,
        }),
      ).pairs

    expect(createFirstRound(1, "seed-one")).not.toEqual(
      createFirstRound(1, "seed-two"),
    )
    expect(createFirstRound(1, "seed-one")).not.toEqual(
      createFirstRound(2, "seed-one"),
    )
  })

  it("advances within a cycle and signals its exact boundary", () => {
    const activeDeck = createDeck(0)
    const initialRestorePoint = createSchedulerRestorePoint({
      activeDeck,
      rankingEpoch: 1,
      seed: "advance-seed",
      cycleIndex: 0,
    })
    const advancedRestorePoint = advanceSchedulerCursor(
      activeDeck,
      initialRestorePoint,
    )
    const finalRestorePoint = createSchedulerRestorePoint({
      activeDeck,
      rankingEpoch: 1,
      seed: "advance-seed",
      cycleIndex: 0,
      cursor: getPairCount(activeDeck.valueIds.length) - 1,
    })

    expect(advancedRestorePoint?.cursor).toBe(1)
    expect(advanceSchedulerCursor(activeDeck, finalRestorePoint)).toBeNull()
  })

  it("rejects mismatched, unsupported, and out-of-range restore points", () => {
    const activeDeck = createDeck(0)
    const restorePoint = createSchedulerRestorePoint({
      activeDeck,
      rankingEpoch: 1,
      seed: "validation-seed",
      cycleIndex: 0,
    })
    const changedDeck = createDeck(1)
    const mismatchedRestorePoint = {
      ...restorePoint,
      activeDeckFingerprint: changedDeck.fingerprint,
    }
    const unsupportedRestorePoint = {
      ...restorePoint,
      algorithmVersion: PAIR_SCHEDULER_ALGORITHM_VERSION + 1,
    } as unknown as SchedulerRestorePoint

    expect(() =>
      projectScheduledPair(activeDeck, mismatchedRestorePoint),
    ).toThrow("fingerprint does not match")
    expect(() =>
      projectScheduledPair(activeDeck, unsupportedRestorePoint),
    ).toThrow("Unsupported pair scheduler algorithm")
    expect(() =>
      createSchedulerRestorePoint({
        activeDeck,
        rankingEpoch: 1,
        seed: "validation-seed",
        cycleIndex: 0,
        cursor: getPairCount(activeDeck.valueIds.length),
      }),
    ).toThrow("Invalid scheduler cursor")
  })
})
