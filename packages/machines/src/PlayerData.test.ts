import { describe, expect, it } from "vitest"
import { readAchievementId } from "./AchievementCatalog"
import { createBoundedBattleIdSet } from "./AchievementState"
import { applyAchievementTransition } from "./AchievementTransition"
import { applyBattleChoice } from "./BattleProfile"
import { createBattleChoiceEvent } from "./BattleProfileEvent"
import { projectBattlePair } from "./BattleScheduler"
import { createInitialPlayerData, createPlayerData } from "./PlayerData"

const CREATED_AT = "2026-07-29T00:00:00.000Z"

function createPlayerDataAfterOneBattle() {
  const initial = createInitialPlayerData({
    schedulerSeed: "player-data-seed",
    createdAt: CREATED_AT,
  })
  const pair = projectBattlePair(
    initial.profile.activeDeck,
    initial.profile.scheduler,
  )
  const transition = applyBattleChoice({
    profile: initial.profile,
    winnerId: pair[0],
    expectedScheduler: initial.profile.scheduler,
  })
  const event = createBattleChoiceEvent(transition)

  return createPlayerData({
    ...initial,
    profile: transition.profile,
    achievements: applyAchievementTransition({
      state: initial.achievements,
      priorProfile: initial.profile,
      resultingProfile: transition.profile,
      event,
      occurredAt: "2026-07-29T00:01:00.000Z",
    }),
  })
}

describe("Player Data", () => {
  it("creates one complete launch profile with shared durable defaults", () => {
    const playerData = createInitialPlayerData({
      schedulerSeed: "initial-player-data-seed",
      createdAt: CREATED_AT,
    })

    expect(playerData.progressGenerationStartedAt).toBe(CREATED_AT)
    expect(playerData.profile.scheduler.progressGeneration).toBe(0)
    expect(playerData.achievements.progress.achievementProgressGeneration).toBe(
      0,
    )
    expect(playerData.settings).toMatchObject({
      locale: "en",
      reducedMotion: "system",
    })
  })

  it("accepts coherent profile and achievement timeline evidence", () => {
    const playerData = createPlayerDataAfterOneBattle()

    expect(playerData.profile.history).toHaveLength(1)
    expect(playerData.achievements.progress.countedBattleWindow.ids).toEqual([
      playerData.profile.history[0]!.battleId,
    ])
    expect(
      new Set(playerData.achievements.unlocks.map(({ id }) => id)),
    ).toEqual(new Set([readAchievementId("battle.first", "Achievement ID")]))
  })

  it("rejects achievement windows that disagree with the retained timeline", () => {
    const playerData = createPlayerDataAfterOneBattle()

    expect(() =>
      createPlayerData({
        ...playerData,
        achievements: {
          ...playerData.achievements,
          progress: {
            ...playerData.achievements.progress,
            countedBattleWindow: createBoundedBattleIdSet([]),
          },
        },
      }),
    ).toThrow("does not match the retained timeline")
  })

  it("rejects unlocks that exceed their supporting durable counters", () => {
    const playerData = createPlayerDataAfterOneBattle()
    const tenBattlesId = readAchievementId("battle.10", "Achievement ID")

    expect(() =>
      createPlayerData({
        ...playerData,
        achievements: {
          ...playerData.achievements,
          unlocks: [
            ...playerData.achievements.unlocks,
            {
              id: tenBattlesId,
              unlockedAt: "2026-07-29T00:02:00.000Z",
              eventToken: "ten-battle-event",
            },
          ],
        },
      }),
    ).toThrow("exceeds its lifetime battle count")
  })

  it("rejects cycle unlocks without a completed cycle", () => {
    const playerData = createInitialPlayerData({
      schedulerSeed: "invalid-cycle-unlock-seed",
      createdAt: CREATED_AT,
    })
    const firstCycleId = readAchievementId("cycle.first", "Achievement ID")

    expect(() =>
      createPlayerData({
        ...playerData,
        achievements: {
          ...playerData.achievements,
          unlocks: [
            {
              id: firstCycleId,
              unlockedAt: "2026-07-29T00:02:00.000Z",
              eventToken: "first-cycle-event",
            },
          ],
        },
      }),
    ).toThrow("exceeds its completed-cycle count")
  })

  it("accepts cycle unlocks supported by a completed cycle", () => {
    const playerData = createInitialPlayerData({
      schedulerSeed: "valid-cycle-unlock-seed",
      createdAt: CREATED_AT,
    })
    const firstCycleId = readAchievementId("cycle.first", "Achievement ID")

    const validated = createPlayerData({
      ...playerData,
      achievements: {
        ...playerData.achievements,
        unlocks: [
          {
            id: firstCycleId,
            unlockedAt: "2026-07-29T00:02:00.000Z",
            eventToken: "first-cycle-event",
          },
        ],
        progress: {
          ...playerData.achievements.progress,
          lifetimeBattleCount: 1,
          completedCycleCount: 1,
        },
      },
    })

    expect(validated.achievements.unlocks).toHaveLength(1)
    expect(validated.achievements.progress.completedCycleCount).toBe(1)
  })
})
