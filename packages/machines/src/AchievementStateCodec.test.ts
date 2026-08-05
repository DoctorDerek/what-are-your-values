import { createActiveDeck } from "@game/data/src/ActiveDeck"
import { describe, expect, it } from "vitest"
import { readAchievementId } from "./AchievementCatalog"
import {
  createAchievementState,
  createBoundedBattleIdSet,
  createInitialAchievementState,
} from "./AchievementState"
import {
  decodeAchievementState,
  encodeAchievementState,
} from "./AchievementStateCodec"
import { createBattleId } from "./BattleIdentity"
import { createSchedulerRestorePoint } from "./PairScheduler"

function createPopulatedAchievementState() {
  const activeDeck = createActiveDeck([])
  const battleId = createBattleId(
    createSchedulerRestorePoint({
      activeDeck,
      progressGeneration: 0,
      deckRevision: 0,
      seed: "achievement-codec-seed",
      cycleIndex: 0,
    }),
  )
  const firstBattleId = readAchievementId("battle.first", "Achievement ID")

  return {
    activeDeck,
    state: createAchievementState({
      activeDeck,
      unlocks: [
        {
          id: firstBattleId,
          unlockedAt: "2026-07-29T00:00:00.000Z",
          eventToken: battleId,
        },
      ],
      presentedAchievementIds: [firstBattleId],
      progress: {
        ...createInitialAchievementState(activeDeck).progress,
        lifetimeBattleCount: 1,
        countedBattleWindow: createBoundedBattleIdSet([battleId]),
      },
    }),
  }
}

describe("Achievement State Codec", () => {
  it("round-trips empty and populated achievement state canonically", () => {
    const { activeDeck, state } = createPopulatedAchievementState()
    const empty = createInitialAchievementState(activeDeck)

    expect(
      decodeAchievementState(activeDeck, encodeAchievementState(empty)),
    ).toEqual(empty)
    expect(
      decodeAchievementState(activeDeck, encodeAchievementState(state)),
    ).toEqual(state)
  })

  it("rejects unsupported versions and malformed collection fields", () => {
    const { activeDeck, state } = createPopulatedAchievementState()
    const encoded = encodeAchievementState(state)
    const malformedCountedBattleProgress: unknown[] = [...encoded[3]]
    malformedCountedBattleProgress[4] = "counted-battles"

    expect(() =>
      decodeAchievementState(activeDeck, [2, ...encoded.slice(1)]),
    ).toThrow("Unsupported Achievement State codec version")
    expect(() =>
      decodeAchievementState(activeDeck, [
        1,
        "unlocks",
        encoded[2],
        encoded[3],
      ]),
    ).toThrow("Invalid Achievement Unlocks")
    expect(() =>
      decodeAchievementState(activeDeck, [
        1,
        encoded[1],
        "presented",
        encoded[3],
      ]),
    ).toThrow("Invalid Presented Achievement IDs")
    expect(() =>
      decodeAchievementState(activeDeck, [1, encoded[1], encoded[2], []]),
    ).toThrow("Invalid Achievement Progress")
    expect(() =>
      decodeAchievementState(activeDeck, [
        1,
        encoded[1],
        encoded[2],
        malformedCountedBattleProgress,
      ]),
    ).toThrow("Invalid Counted Battle window")
  })

  it("rejects unknown achievements and malformed Battle IDs", () => {
    const { activeDeck, state } = createPopulatedAchievementState()
    const encoded = encodeAchievementState(state)
    const unknownUnlocks = encoded[1].map((unlock) => [...unlock])
    const malformedProgress = [...encoded[3]]

    unknownUnlocks[0]![0] = "battle.11"
    malformedProgress[4] = ["not-a-battle-id"]

    expect(() =>
      decodeAchievementState(activeDeck, [
        1,
        unknownUnlocks,
        encoded[2],
        encoded[3],
      ]),
    ).toThrow("Invalid Achievement Unlock 0 ID")
    expect(() =>
      decodeAchievementState(activeDeck, [
        1,
        encoded[1],
        encoded[2],
        malformedProgress,
      ]),
    ).toThrow("Invalid Counted Battle ID 0")
  })

  it("rejects noncanonical state representations", () => {
    const { activeDeck, state } = createPopulatedAchievementState()
    const encoded = encodeAchievementState(state)

    expect(() =>
      decodeAchievementState(activeDeck, [
        1,
        encoded[1],
        encoded[2],
        [...encoded[3], null],
      ]),
    ).toThrow("Invalid Achievement Progress")
  })
})
