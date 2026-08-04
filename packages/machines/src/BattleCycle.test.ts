import { getPairCount } from "@game/data/src/ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
  type ValueId,
} from "@game/data/src/Value"
import {
  createValueProgressById,
  type ValueProgress,
} from "@game/data/src/ValueProgress"
import { getPayoutTierFromXP } from "@game/utils/src/LevelMath"
import { describe, expect, it } from "vitest"
import {
  createBattleCycleCandidate,
  createInitialBattleCycle,
  type BattleCycleState,
} from "./BattleCycle"
import { createBattleDelta } from "./BattleDelta"
import { createBattleId, createCycleCompleteEventId } from "./BattleIdentity"
import { applyDeckRevision, createInitialBattleProfile } from "./BattleProfile"
import { projectBattlePair } from "./BattleScheduler"
import { createDeckReconfigurationRestorePoint } from "./DeckReconfigurationScheduler"
import {
  createSchedulerRestorePoint,
  projectScheduledPair,
} from "./PairScheduler"

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

function replaceProgress(
  battleCycle: BattleCycleState,
  replacements: ReadonlyMap<ValueId, ValueProgress>,
) {
  return createValueProgressById(
    battleCycle.activeDeck,
    battleCycle.activeDeck.valueIds.map((valueId) => {
      const progress =
        replacements.get(valueId) ?? battleCycle.progressById.get(valueId)

      if (!progress) {
        throw new Error(`Value Progress is missing ${valueId}`)
      }

      return [valueId, progress]
    }),
  )
}

describe("Battle Cycle", () => {
  it("initializes the complete canonical Active Deck and one compact projection", () => {
    const battleCycle = createInitialBattleCycle("initial-cycle-seed")
    const projection = projectScheduledPair(
      battleCycle.activeDeck,
      battleCycle.scheduler,
    )

    expect(battleCycle.activeDeck.valueIds).toHaveLength(100)
    expect(
      battleCycle.activeDeck.valueIds.every((valueId) =>
        valueId.startsWith("pvcs-2011:"),
      ),
    ).toBe(true)
    expect(battleCycle.progressById.size).toBe(100)
    expect(battleCycle.cyclePayoutTierSnapshot.size).toBe(100)
    expect(battleCycle.scheduler.cursor).toBe(0)
    expect(battleCycle.scheduler).not.toHaveProperty("pairs")
    expect(projection.pair).toHaveLength(2)
  })

  it("commits one first-cycle winner and rejects the stale command afterward", () => {
    const battleCycle = createInitialBattleCycle("single-battle-seed")
    const pair = projectScheduledPair(
      battleCycle.activeDeck,
      battleCycle.scheduler,
    ).pair
    const [winnerId, loserId] = pair
    const candidate = createBattleCycleCandidate({
      battleCycle,
      winnerId,
      expectedScheduler: battleCycle.scheduler,
    })

    expect(candidate.delta).toMatchObject({
      version: 1,
      pair,
      winnerId,
      loserId,
      xpGained: 4,
      progressGeneration: 0,
      deckRevision: 0,
      activeDeckFingerprint: battleCycle.activeDeck.fingerprint,
      cycleIndex: 0,
      priorScheduler: battleCycle.scheduler,
      resultingScheduler: candidate.scheduler,
      cycleBoundary: null,
    })
    expect(candidate.delta.battleId).toBe(createBattleId(battleCycle.scheduler))
    expect(candidate.progressById.get(winnerId)).toEqual({
      totalXp: 4,
      profileWins: 1,
      profileComparisons: 1,
      currentCycleWins: 1,
    })
    expect(candidate.progressById.get(loserId)).toEqual({
      totalXp: 0,
      profileWins: 0,
      profileComparisons: 1,
      currentCycleWins: 0,
    })
    expect(candidate.scheduler.cursor).toBe(1)
    expect(candidate.cyclePayoutTierSnapshot).toBe(
      battleCycle.cyclePayoutTierSnapshot,
    )
    expect(battleCycle.progressById.get(winnerId)?.totalXp).toBe(0)
    expect(() =>
      createBattleCycleCandidate({
        battleCycle: candidate,
        winnerId,
        expectedScheduler: battleCycle.scheduler,
      }),
    ).toThrow("does not match the current scheduler")
  })

  it("rolls the final battle atomically into a fresh cycle snapshot", () => {
    const initialBattleCycle = createInitialBattleCycle("rollover-seed")
    const finalScheduler = createSchedulerRestorePoint({
      activeDeck: initialBattleCycle.activeDeck,
      progressGeneration: 0,
      deckRevision: 0,
      seed: initialBattleCycle.scheduler.seed,
      cycleIndex: 0,
      cursor: getPairCount(initialBattleCycle.activeDeck.valueIds.length) - 1,
    })
    const [winnerId, loserId] = projectScheduledPair(
      initialBattleCycle.activeDeck,
      finalScheduler,
    ).pair
    const progressById = replaceProgress(
      initialBattleCycle,
      new Map([
        [winnerId, createProgress(12, 2, 3, 1)],
        [loserId, createProgress(420, 7, 12, 1)],
      ]),
    )
    const battleCycle = Object.freeze({
      ...initialBattleCycle,
      progressById,
      scheduler: finalScheduler,
    }) satisfies BattleCycleState
    const candidate = createBattleCycleCandidate({
      battleCycle,
      winnerId,
      expectedScheduler: finalScheduler,
    })

    expect(candidate.delta.xpGained).toBe(4)
    expect(candidate.delta.resultingWinnerProgress.currentCycleWins).toBe(2)
    expect(candidate.delta.priorScheduler).toBe(finalScheduler)
    expect(candidate.delta.resultingScheduler).toBe(candidate.scheduler)
    expect(candidate.delta.cycleBoundary).not.toBeNull()
    expect(candidate.delta.cycleBoundary?.cycleCompleteEventId).toBe(
      createCycleCompleteEventId(createBattleId(finalScheduler)),
    )
    expect(
      candidate.delta.cycleBoundary?.priorCurrentCycleWinsById.get(winnerId),
    ).toBe(1)
    expect(
      candidate.delta.cycleBoundary?.priorCurrentCycleWinsById.get(loserId),
    ).toBe(1)
    expect(
      Array.from(
        candidate.delta.cycleBoundary?.resultingCurrentCycleWinsById.values() ??
          [],
      ).every((currentCycleWins) => currentCycleWins === 0),
    ).toBe(true)
    expect(candidate.delta.cycleBoundary?.priorCyclePayoutTierSnapshot).toEqual(
      battleCycle.cyclePayoutTierSnapshot,
    )
    expect(
      candidate.delta.cycleBoundary?.resultingCyclePayoutTierSnapshot,
    ).toEqual(candidate.cyclePayoutTierSnapshot)
    expect(candidate.progressById.get(winnerId)).toEqual({
      totalXp: 16,
      profileWins: 3,
      profileComparisons: 4,
      currentCycleWins: 0,
    })
    expect(candidate.progressById.get(loserId)).toEqual({
      totalXp: 420,
      profileWins: 7,
      profileComparisons: 13,
      currentCycleWins: 0,
    })
    expect(
      Array.from(candidate.progressById.values()).every(
        ({ currentCycleWins }) => currentCycleWins === 0,
      ),
    ).toBe(true)
    expect(candidate.scheduler.cycleIndex).toBe(1)
    expect(candidate.scheduler.cursor).toBe(0)
    expect(candidate.cyclePayoutTierSnapshot.get(winnerId)).toBe(
      getPayoutTierFromXP(16),
    )
    expect(candidate.cyclePayoutTierSnapshot.get(loserId)).toBe(
      getPayoutTierFromXP(420),
    )
    expect(() =>
      createBattleDelta({
        activeDeck: battleCycle.activeDeck,
        progressDelta: candidate.delta,
        priorScheduler: finalScheduler,
        resultingScheduler: finalScheduler,
        cycleBoundary: candidate.delta.cycleBoundary,
      }),
    ).toThrow("scheduler transition is inconsistent")
  })

  it("completes a Join Pass before starting the next ordinary cycle", () => {
    const customValue = Object.freeze({
      kind: "custom",
      id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
      name: "Ingenuity",
      definition: "To make original solutions.",
      creationOrdinal: 1,
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
    }) satisfies CustomValueDefinition
    const revisedProfile = applyDeckRevision({
      profile: createInitialBattleProfile("join-pass-boundary-seed"),
      revisedCustomValues: [customValue],
    }).profile
    const finalScheduler = createDeckReconfigurationRestorePoint({
      activeDeck: revisedProfile.activeDeck,
      joinedValueIds: [customValue.id],
      progressGeneration: revisedProfile.scheduler.progressGeneration,
      deckRevision: revisedProfile.scheduler.deckRevision,
      seed: revisedProfile.scheduler.seed,
      cycleIndex: revisedProfile.scheduler.cycleIndex,
      cursor: getPairCount(revisedProfile.activeDeck.valueIds.length) - 1,
    })
    const battleCycle = Object.freeze({
      activeDeck: revisedProfile.activeDeck,
      progressById: revisedProfile.progressById,
      cyclePayoutTierSnapshot: revisedProfile.cyclePayoutTierSnapshot,
      scheduler: finalScheduler,
    }) satisfies BattleCycleState
    const [winnerId] = projectBattlePair(
      battleCycle.activeDeck,
      battleCycle.scheduler,
    )
    const candidate = createBattleCycleCandidate({
      battleCycle,
      winnerId,
      expectedScheduler: finalScheduler,
    })

    expect(candidate.delta.cycleBoundary).not.toBeNull()
    expect(candidate.delta.resultingScheduler.scheduleKind).toBe("full-cycle")
    expect(candidate.delta.resultingScheduler.cycleIndex).toBe(1)
    expect(candidate.scheduler.cursor).toBe(0)
  })
})
