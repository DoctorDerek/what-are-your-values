import { createActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
  type ValueId,
  type ValuePair,
} from "@game/data/src/Value"
import {
  createInitialValueProgress,
  type ValueProgress,
  type ValueProgressById,
} from "@game/data/src/ValueProgress"
import {
  getLevelFromXP,
  MAX_SUPPORTED_TOTAL_XP,
} from "@game/utils/src/LevelMath"
import { describe, expect, it } from "vitest"
import { createBattleProgressCandidate } from "./BattleProgress"
import { createCycleLevelSnapshot } from "./CycleLevelSnapshot"
import { createDeckRevisionCandidate } from "./DeckRevision"

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

describe("Battle Progress", () => {
  it("awards the losing value's frozen snapshot level and updates exact counters", () => {
    const activeDeck = createActiveDeck([])
    const [winnerId, loserId] = activeDeck.valueIds
    const winnerProgress = createProgress(6, 3, 5, 2)
    const loserProgress = createProgress(210, 7, 12, 1)
    const progressById = setProgress(
      setProgress(
        createInitialValueProgress(activeDeck),
        winnerId,
        winnerProgress,
      ),
      loserId,
      loserProgress,
    )
    const cycleLevelSnapshot = new Map(
      createCycleLevelSnapshot(activeDeck, progressById),
    )
    cycleLevelSnapshot.set(loserId, 15)
    const candidate = createBattleProgressCandidate({
      activeDeck,
      progressById,
      cycleLevelSnapshot,
      pair: [winnerId, loserId],
      winnerId,
    })

    expect(getLevelFromXP(loserProgress.totalXp)).toBeGreaterThan(15)
    expect(candidate.delta.xpGained).toBe(15)
    expect(candidate.progressById.get(winnerId)).toEqual({
      totalXp: 21,
      profileWins: 4,
      profileComparisons: 6,
      currentCycleWins: 3,
    })
    expect(candidate.progressById.get(loserId)).toEqual({
      ...loserProgress,
      profileComparisons: 13,
    })
    expect(candidate.delta).toMatchObject({ winnerId, loserId })
    expect(progressById.get(winnerId)).toEqual(winnerProgress)
  })

  it("caps a high snapshotted opponent at 100 XP", () => {
    const activeDeck = createActiveDeck([])
    const [winnerId, loserId] = activeDeck.valueIds
    const progressById = createInitialValueProgress(activeDeck)
    const cycleLevelSnapshot = new Map(
      createCycleLevelSnapshot(activeDeck, progressById),
    )
    cycleLevelSnapshot.set(loserId, 130)

    expect(
      createBattleProgressCandidate({
        activeDeck,
        progressById,
        cycleLevelSnapshot,
        pair: [winnerId, loserId],
        winnerId,
      }).delta.xpGained,
    ).toBe(100)
  })

  it("produces the same progress for the same choices in either pair order", () => {
    const activeDeck = createActiveDeck([])
    const [winnerId, firstLoserId, secondLoserId] = activeDeck.valueIds
    const initialProgressById = createInitialValueProgress(activeDeck)
    const cycleLevelSnapshot = new Map(
      createCycleLevelSnapshot(activeDeck, initialProgressById),
    )
    cycleLevelSnapshot.set(firstLoserId, 15)
    cycleLevelSnapshot.set(secondLoserId, 27)
    const applyPairs = (pairs: readonly ValuePair[]) =>
      pairs.reduce(
        (progressById, pair) =>
          createBattleProgressCandidate({
            activeDeck,
            progressById,
            cycleLevelSnapshot,
            pair,
            winnerId,
          }).progressById,
        initialProgressById,
      )
    const firstOrder = applyPairs([
      [winnerId, firstLoserId],
      [winnerId, secondLoserId],
    ])
    const secondOrder = applyPairs([
      [winnerId, secondLoserId],
      [winnerId, firstLoserId],
    ])

    expect(Array.from(firstOrder)).toEqual(Array.from(secondOrder))
    expect(firstOrder.get(winnerId)?.totalXp).toBe(42)
  })

  it("gives a joined value evidence-earned catch-up and retained winners one XP", () => {
    const ingenuity = createCustomValue(1)
    const priorActiveDeck = createActiveDeck([])
    const retainedId = priorActiveDeck.valueIds[0]
    const retainedProgress = createProgress(190, 10, 20, 4)
    const revision = createDeckRevisionCandidate({
      priorActiveDeck,
      revisedCustomValues: [ingenuity],
      progressById: setProgress(
        createInitialValueProgress(priorActiveDeck),
        retainedId,
        retainedProgress,
      ),
      deckRevision: 0,
      progressGeneration: 0,
      seed: "ingenuity-catch-up",
    })
    const joinedWinner = createBattleProgressCandidate({
      activeDeck: revision.activeDeck,
      progressById: revision.progressById,
      cycleLevelSnapshot: revision.cycleLevelSnapshot,
      pair: [ingenuity.id, retainedId],
      winnerId: ingenuity.id,
    })
    const retainedWinner = createBattleProgressCandidate({
      activeDeck: revision.activeDeck,
      progressById: revision.progressById,
      cycleLevelSnapshot: revision.cycleLevelSnapshot,
      pair: [ingenuity.id, retainedId],
      winnerId: retainedId,
    })

    expect(joinedWinner.delta.xpGained).toBe(
      getLevelFromXP(retainedProgress.totalXp),
    )
    expect(retainedWinner.delta.xpGained).toBe(1)
  })

  it("rejects invalid pairs, winners, snapshots, and unsafe increments", () => {
    const activeDeck = createActiveDeck([])
    const [firstValueId, secondValueId, thirdValueId] = activeDeck.valueIds
    const initialProgressById = createInitialValueProgress(activeDeck)
    const cycleLevelSnapshot = createCycleLevelSnapshot(
      activeDeck,
      initialProgressById,
    )
    const createCandidate = (
      pair: ValuePair,
      winnerId: ValueId,
      progressById = initialProgressById,
    ) =>
      createBattleProgressCandidate({
        activeDeck,
        progressById,
        cycleLevelSnapshot,
        pair,
        winnerId,
      })

    expect(() =>
      createCandidate([firstValueId, firstValueId], firstValueId),
    ).toThrow("two distinct Value IDs")
    expect(() =>
      createCandidate([firstValueId, secondValueId], thirdValueId),
    ).toThrow("winner is not part")
    expect(() =>
      createCandidate([firstValueId, createCustomValue(1).id], firstValueId),
    ).toThrow("inactive Value ID")

    const incompleteSnapshot = new Map(cycleLevelSnapshot)
    incompleteSnapshot.delete(secondValueId)
    expect(() =>
      createBattleProgressCandidate({
        activeDeck,
        progressById: initialProgressById,
        cycleLevelSnapshot: incompleteSnapshot,
        pair: [firstValueId, secondValueId],
        winnerId: firstValueId,
      }),
    ).toThrow("does not cover the complete Active Deck")

    const maximumProgressById = setProgress(
      initialProgressById,
      firstValueId,
      createProgress(MAX_SUPPORTED_TOTAL_XP, 0, 0, 0),
    )
    expect(() =>
      createCandidate(
        [firstValueId, secondValueId],
        firstValueId,
        maximumProgressById,
      ),
    ).toThrow("Total XP cannot be incremented safely")
  })
})
