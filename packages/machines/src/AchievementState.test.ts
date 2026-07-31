import { createActiveDeck } from "@game/data/src/ActiveDeck"
import { CANONICAL_VALUES } from "@game/data/src/CanonicalValues"
import { createCanonicalValueId } from "@game/data/src/Value"
import { describe, expect, it } from "vitest"
import { readAchievementId } from "./AchievementCatalog"
import {
  COUNTED_BATTLE_WINDOW_CAPACITY,
  createAchievementState,
  createBoundedBattleIdSet,
  createInitialAchievementState,
  getPendingAchievementUnlocks,
} from "./AchievementState"
import { createBattleId } from "./BattleIdentity"
import { createSchedulerRestorePoint } from "./PairScheduler"

function createCountedBattleId(cursor: number) {
  const activeDeck = createActiveDeck([])
  return createBattleId(
    createSchedulerRestorePoint({
      activeDeck,
      progressGeneration: 0,
      deckRevision: 0,
      seed: "achievement-state-seed",
      cycleIndex: 0,
      cursor,
    }),
  )
}

describe("Achievement State", () => {
  it("creates an empty generation with a Level-1 baseline for every value", () => {
    const activeDeck = createActiveDeck([])
    const state = createInitialAchievementState(activeDeck)

    expect(state.unlocks).toEqual([])
    expect(state.presentedAchievementIds).toEqual([])
    expect(state.progress).toMatchObject({
      achievementProgressGeneration: 0,
      lifetimeBattleCount: 0,
      completedCycleCount: 0,
      topFiveAlreadyRevealedAtReset: false,
      countedBattleWindow: {
        ids: [],
        capacity: COUNTED_BATTLE_WINDOW_CAPACITY,
      },
    })
    expect(state.progress.baselineLevelsByValue).toHaveLength(
      CANONICAL_VALUES.length,
    )
    expect(new Set(state.progress.baselineLevelsByValue.values())).toEqual(
      new Set([1]),
    )
  })

  it("derives pending presentations without changing durable unlock order", () => {
    const activeDeck = createActiveDeck([])
    const firstBattleId = readAchievementId("battle.first", "Achievement ID")
    const tenBattlesId = readAchievementId("battle.10", "Achievement ID")
    const state = createAchievementState({
      activeDeck,
      unlocks: [
        {
          id: firstBattleId,
          unlockedAt: "2026-07-29T00:00:00.000Z",
          eventToken: "first-event",
        },
        {
          id: tenBattlesId,
          unlockedAt: "2026-07-29T00:10:00.000Z",
          eventToken: "tenth-event",
        },
      ],
      presentedAchievementIds: [firstBattleId],
      progress: {
        ...createInitialAchievementState(activeDeck).progress,
        lifetimeBattleCount: 10,
      },
    })

    expect(getPendingAchievementUnlocks(state).map(({ id }) => id)).toEqual([
      tenBattlesId,
    ])
    expect(state.unlocks.map(({ id }) => id)).toEqual([
      firstBattleId,
      tenBattlesId,
    ])
  })

  it("rejects duplicate, missing, and inconsistent unlock evidence", () => {
    const activeDeck = createActiveDeck([])
    const firstBattleId = readAchievementId("battle.first", "Achievement ID")
    const tenBattlesId = readAchievementId("battle.10", "Achievement ID")
    const initial = createInitialAchievementState(activeDeck)
    const unlock = {
      id: firstBattleId,
      unlockedAt: "2026-07-29T00:00:00.000Z",
      eventToken: "first-event",
    }

    expect(() =>
      createAchievementState({
        activeDeck,
        unlocks: [unlock, unlock],
        presentedAchievementIds: [],
        progress: initial.progress,
      }),
    ).toThrow("Achievement unlocks contains duplicate values")
    expect(() =>
      createAchievementState({
        activeDeck,
        unlocks: [{ ...unlock, eventToken: "" }],
        presentedAchievementIds: [],
        progress: initial.progress,
      }),
    ).toThrow("Achievement event token is required")
    expect(() =>
      createAchievementState({
        activeDeck,
        unlocks: [],
        presentedAchievementIds: [firstBattleId],
        progress: initial.progress,
      }),
    ).toThrow("Presented Achievement is not unlocked")
    expect(() =>
      createAchievementState({
        activeDeck,
        unlocks: [
          unlock,
          {
            id: tenBattlesId,
            unlockedAt: "2026-07-29T00:10:00.000Z",
            eventToken: "tenth-event",
          },
        ],
        presentedAchievementIds: [tenBattlesId],
        progress: {
          ...initial.progress,
          lifetimeBattleCount: 10,
        },
      }),
    ).toThrow("does not follow unlock order")
  })

  it("rejects malformed achievement progress and baseline coverage", () => {
    const activeDeck = createActiveDeck([])
    const initial = createInitialAchievementState(activeDeck)
    const firstValueId = activeDeck.valueIds[0]
    if (!firstValueId) {
      throw new Error("Canonical test deck is empty")
    }
    const inactiveBaselineLevelsByValue = new Map(
      initial.progress.baselineLevelsByValue,
    )
    inactiveBaselineLevelsByValue.delete(firstValueId)
    inactiveBaselineLevelsByValue.set(
      createCanonicalValueId("pvcs-2011:inactive-test-value"),
      1,
    )

    expect(() =>
      createAchievementState({
        activeDeck,
        unlocks: [],
        presentedAchievementIds: [],
        progress: {
          ...initial.progress,
          baselineLevelsByValue: new Map(
            Array.from(initial.progress.baselineLevelsByValue).slice(1),
          ),
        },
      }),
    ).toThrow("do not cover the complete Active Deck")
    expect(() =>
      createAchievementState({
        activeDeck,
        unlocks: [],
        presentedAchievementIds: [],
        progress: {
          ...initial.progress,
          baselineLevelsByValue: inactiveBaselineLevelsByValue,
        },
      }),
    ).toThrow("contain an inactive ID")
    expect(() =>
      createAchievementState({
        activeDeck,
        unlocks: [],
        presentedAchievementIds: [],
        progress: {
          ...initial.progress,
          baselineLevelsByValue: new Map(
            Array.from(
              initial.progress.baselineLevelsByValue,
              ([id, level]) => [id, id === firstValueId ? 0 : level],
            ),
          ),
        },
      }),
    ).toThrow("Invalid Achievement baseline level")
    expect(() =>
      createAchievementState({
        activeDeck,
        unlocks: [],
        presentedAchievementIds: [],
        progress: {
          ...initial.progress,
          lifetimeBattleCount: 0,
          countedBattleWindow: createBoundedBattleIdSet([
            createCountedBattleId(0),
          ]),
        },
      }),
    ).toThrow("lower than its counted window")
    expect(() =>
      createAchievementState({
        activeDeck,
        unlocks: [],
        presentedAchievementIds: [],
        progress: {
          ...initial.progress,
          lifetimeBattleCount: 1,
          completedCycleCount: 2,
        },
      }),
    ).toThrow("exceeds lifetime battles")
    expect(() =>
      createAchievementState({
        activeDeck,
        unlocks: [],
        presentedAchievementIds: [],
        progress: {
          ...initial.progress,
          topFiveAlreadyRevealedAtReset: "yes" as unknown as boolean,
        },
      }),
    ).toThrow("Invalid Top Five achievement reset baseline")
  })

  it("bounds and deduplicates replay-sensitive battle identities", () => {
    const activeDeck = createActiveDeck([])
    const initial = createInitialAchievementState(activeDeck)
    const battleId = createCountedBattleId(0)

    expect(() => createBoundedBattleIdSet(["" as typeof battleId])).toThrow(
      "contains an empty Battle ID",
    )
    expect(() =>
      createAchievementState({
        activeDeck,
        unlocks: [],
        presentedAchievementIds: [],
        progress: {
          ...initial.progress,
          lifetimeBattleCount: 2,
          countedBattleWindow: {
            ids: [battleId, battleId],
            capacity: COUNTED_BATTLE_WINDOW_CAPACITY,
          },
        },
      }),
    ).toThrow("Counted Battle window contains duplicate values")

    const oversizedWindow = Array.from(
      { length: COUNTED_BATTLE_WINDOW_CAPACITY + 1 },
      (_unused, index) => `battle:${index}` as typeof battleId,
    )
    expect(() =>
      createAchievementState({
        activeDeck,
        unlocks: [],
        presentedAchievementIds: [],
        progress: {
          ...initial.progress,
          lifetimeBattleCount: oversizedWindow.length,
          countedBattleWindow: {
            ids: oversizedWindow,
            capacity: COUNTED_BATTLE_WINDOW_CAPACITY,
          },
        },
      }),
    ).toThrow("exceeds its bounded capacity")

    expect(() =>
      createAchievementState({
        activeDeck,
        unlocks: [],
        presentedAchievementIds: [],
        progress: {
          ...initial.progress,
          countedBattleWindow: {
            ids: [],
            capacity: COUNTED_BATTLE_WINDOW_CAPACITY - 1,
          },
        },
      }),
    ).toThrow("has a noncanonical capacity")
  })
})
