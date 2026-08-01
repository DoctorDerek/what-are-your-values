import { describe, expect, it } from "vitest"
import { createActor, toPromise } from "xstate"
import { readAchievementId } from "./AchievementCatalog"
import { recordAchievementPresentationActor } from "./AchievementPresentationActors"
import {
  createAchievementState,
  createInitialAchievementState,
  getPendingAchievementUnlocks,
} from "./AchievementState"
import { hydrateBattleProfileStore } from "./BattleProfileHydration"
import {
  BATTLE_PROFILE_MANIFEST_KEY,
  initializeBattleProfileStore,
  replaceBattleProfileStorePlayerDataForLocalMutation,
} from "./BattleProfileStore"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"
import { createInitialPlayerData, createPlayerData } from "./PlayerData"

const PRESENTED_AT = "2026-07-29T12:34:56.000Z"

async function createUnlockedPresentationFixture() {
  const initialPlayerData = createInitialPlayerData({
    schedulerSeed: "achievement-presentation-actor",
    createdAt: PRESENTED_AT,
  })
  const achievementId = readAchievementId("battle.first", "Achievement ID")
  const playerData = createPlayerData({
    ...initialPlayerData,
    achievements: createAchievementState({
      activeDeck: initialPlayerData.profile.activeDeck,
      unlocks: [
        {
          id: achievementId,
          unlockedAt: PRESENTED_AT,
          eventToken: "achievement-presentation-event",
        },
      ],
      presentedAchievementIds: [],
      progress: {
        ...createInitialAchievementState(initialPlayerData.profile.activeDeck)
          .progress,
        lifetimeBattleCount: 1,
      },
    }),
  })
  const store = createInMemoryDurableStore()
  const state = await initializeBattleProfileStore({
    store,
    playerData,
    createdAt: PRESENTED_AT,
    appVersion: "0.1.0",
  })

  return { achievementId, playerData, state, store }
}

describe("Achievement Presentation Actors", () => {
  it("records one unlocked presentation in a verified next-generation checkpoint", async () => {
    const { achievementId, playerData, state, store } =
      await createUnlockedPresentationFixture()
    const actor = createActor(recordAchievementPresentationActor, {
      input: {
        store,
        state,
        achievementId,
        presentedAt: PRESENTED_AT,
      },
    })
    actor.start()

    const presentedState = await toPromise(actor)

    expect(
      presentedState.head.playerData.achievements.presentedAchievementIds,
    ).toEqual([achievementId])
    expect(presentedState.head.playerData.profile).toEqual(playerData.profile)
    expect(presentedState.head.generation).toBe(state.head.generation + 1)
    expect(presentedState.head.revision).toBe(state.head.revision + 1)
    expect((await store.readAll()).has(BATTLE_PROFILE_MANIFEST_KEY)).toBe(true)
  })

  it("returns the current verified store state without writing an already presented achievement", async () => {
    const { achievementId, state, store } =
      await createUnlockedPresentationFixture()
    const firstActor = createActor(recordAchievementPresentationActor, {
      input: {
        store,
        state,
        achievementId,
        presentedAt: PRESENTED_AT,
      },
    })
    firstActor.start()
    const presentedState = await toPromise(firstActor)
    const beforeReplayEntries = await store.readAll()
    const replayActor = createActor(recordAchievementPresentationActor, {
      input: {
        store,
        state: presentedState,
        achievementId,
        presentedAt: PRESENTED_AT,
      },
    })
    replayActor.start()

    const replayedState = await toPromise(replayActor)

    expect(replayedState).toBe(presentedState)
    await expect(store.readAll()).resolves.toEqual(beforeReplayEntries)
  })

  it("rejects a locked achievement without changing durable records", async () => {
    const initialPlayerData = createInitialPlayerData({
      schedulerSeed: "locked-achievement-presentation",
      createdAt: PRESENTED_AT,
    })
    const store = createInMemoryDurableStore()
    const state = await initializeBattleProfileStore({
      store,
      playerData: initialPlayerData,
      createdAt: PRESENTED_AT,
      appVersion: "0.1.0",
    })
    const beforeEntries = await store.readAll()
    const actor = createActor(recordAchievementPresentationActor, {
      input: {
        store,
        state,
        achievementId: readAchievementId("battle.first", "Achievement ID"),
        presentedAt: PRESENTED_AT,
      },
    })
    actor.start()

    await expect(toPromise(actor)).rejects.toThrow(
      "Presented Achievement is not unlocked",
    )
    await expect(store.readAll()).resolves.toEqual(beforeEntries)
  })

  it("preserves a pending unlock through a stale acknowledgement and later hydration", async () => {
    const { achievementId, state, store } =
      await createUnlockedPresentationFixture()
    const currentState =
      await replaceBattleProfileStorePlayerDataForLocalMutation({
        store,
        state,
        playerData: state.head.playerData,
        replacedAt: PRESENTED_AT,
      })
    const entriesBeforeAcknowledgement = await store.readAll()
    const actor = createActor(recordAchievementPresentationActor, {
      input: {
        store,
        state,
        achievementId,
        presentedAt: PRESENTED_AT,
      },
    })
    actor.start()

    await expect(toPromise(actor)).rejects.toThrow("wayvm.snapshot.manifest")
    await expect(store.readAll()).resolves.toEqual(entriesBeforeAcknowledgement)

    const hydrated = await hydrateBattleProfileStore({
      store,
      appVersion: "0.1.0",
    })

    expect(hydrated.status).toBe("ready")
    if (hydrated.status !== "ready") {
      throw new Error("Achievement presentation fixture did not rehydrate")
    }
    expect(hydrated.state).toEqual(currentState)
    expect(
      getPendingAchievementUnlocks(
        hydrated.state.head.playerData.achievements,
      ).map(({ id }) => id),
    ).toEqual([achievementId])
  })
})
