import { describe, expect, it } from "vitest"
import { createActor, toPromise } from "xstate"
import {
  initializeBattleProfileStore,
  replaceBattleProfileStorePlayerDataForLocalMutation,
} from "./BattleProfileStore"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"
import { createInitialPlayerData } from "./PlayerData"
import {
  createInitialPlayerSettings,
  createPlayerSettings,
  type PlayerSettings,
} from "./PlayerSettings"
import { updatePlayerSettingsActor } from "./PlayerSettingsActors"

const CREATED_AT = "2026-08-21T12:00:00.000Z"
const UPDATED_AT = "2026-08-21T12:01:00.000Z"

async function createSettingsActorFixture() {
  const playerData = createInitialPlayerData({
    schedulerSeed: "player-settings-actor",
    createdAt: CREATED_AT,
  })
  const store = createInMemoryDurableStore()
  const state = await initializeBattleProfileStore({
    store,
    playerData,
    createdAt: CREATED_AT,
    appVersion: "0.1.0",
  })

  return { playerData, state, store }
}

describe("Player Settings Actors", () => {
  it("saves changed settings in a verified next-generation checkpoint", async () => {
    const { playerData, state, store } = await createSettingsActorFixture()
    const settings = createPlayerSettings({
      ...playerData.settings,
      reducedMotion: "on",
      controlHints: "off",
    })
    const actor = createActor(updatePlayerSettingsActor, {
      input: { store, state, settings, updatedAt: UPDATED_AT },
    })
    actor.start()

    const updatedState = await toPromise(actor)

    expect(updatedState.head.playerData.settings).toEqual(settings)
    expect(updatedState.head.playerData.profile).toEqual(playerData.profile)
    expect(updatedState.head.playerData.achievements).toEqual(
      playerData.achievements,
    )
    expect(updatedState.head.playerData.progressGenerationStartedAt).toBe(
      playerData.progressGenerationStartedAt,
    )
    expect(updatedState.head.generation).toBe(state.head.generation + 1)
    expect(updatedState.head.revision).toBe(state.head.revision + 1)
  })

  it("returns the current durable state without writing unchanged settings", async () => {
    const { state, store } = await createSettingsActorFixture()
    const beforeEntries = await store.readAll()
    const actor = createActor(updatePlayerSettingsActor, {
      input: {
        store,
        state,
        settings: createInitialPlayerSettings(),
        updatedAt: UPDATED_AT,
      },
    })
    actor.start()

    const unchangedState = await toPromise(actor)

    expect(unchangedState).toBe(state)
    await expect(store.readAll()).resolves.toEqual(beforeEntries)
  })

  it("rejects invalid settings before changing durable records", async () => {
    const { state, store } = await createSettingsActorFixture()
    const beforeEntries = await store.readAll()
    const invalidSettings = {
      ...createInitialPlayerSettings(),
      locale: "es",
    } as unknown as PlayerSettings
    const actor = createActor(updatePlayerSettingsActor, {
      input: {
        store,
        state,
        settings: invalidSettings,
        updatedAt: UPDATED_AT,
      },
    })
    actor.start()

    await expect(toPromise(actor)).rejects.toThrow("Unsupported locale: es")
    await expect(store.readAll()).resolves.toEqual(beforeEntries)
  })

  it("rejects a stale profile identity without replacing newer data", async () => {
    const { playerData, state, store } = await createSettingsActorFixture()
    const currentState =
      await replaceBattleProfileStorePlayerDataForLocalMutation({
        store,
        state,
        playerData,
        replacedAt: UPDATED_AT,
      })
    const currentEntries = await store.readAll()
    const actor = createActor(updatePlayerSettingsActor, {
      input: {
        store,
        state,
        settings: createPlayerSettings({
          ...playerData.settings,
          reducedMotion: "off",
        }),
        updatedAt: UPDATED_AT,
      },
    })
    actor.start()

    await expect(toPromise(actor)).rejects.toThrow("wayvm.snapshot.manifest")
    await expect(store.readAll()).resolves.toEqual(currentEntries)
    expect(currentState.head.playerData.settings).toEqual(playerData.settings)
  })
})
