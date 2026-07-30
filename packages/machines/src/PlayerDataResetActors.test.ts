import { describe, expect, it } from "vitest"
import { createActor, toPromise } from "xstate"
import {
  BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
  initializeBattleProfileStore,
  replaceBattleProfileStorePlayerData,
} from "./BattleProfileStore"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"
import { createInitialPlayerData } from "./PlayerData"
import {
  applyScopedPlayerDataResetActor,
  deleteAllPlayerDataActor,
} from "./PlayerDataResetActors"

const CREATED_AT = "2026-07-29T00:00:00.000Z"
const RESET_AT = "2026-07-29T12:00:00.000Z"

async function createStoreFixture() {
  const store = createInMemoryDurableStore()
  const playerData = createInitialPlayerData({
    schedulerSeed: "reset-actor-seed",
    createdAt: CREATED_AT,
  })
  const initialState = await initializeBattleProfileStore({
    store,
    playerData,
    createdAt: CREATED_AT,
    appVersion: "0.1.0",
  })
  const state = await replaceBattleProfileStorePlayerData({
    store,
    state: initialState,
    playerData,
    preImportBackupBytes: "retained-reset-actor-backup",
    replacedAt: CREATED_AT,
  })

  return { store, state }
}

describe("Player Data Reset Actors", () => {
  it("derives and atomically stores one scoped reset while retaining recovery records", async () => {
    const { store, state } = await createStoreFixture()
    const actor = createActor(applyScopedPlayerDataResetActor, {
      input: {
        store,
        state,
        playerData: state.head.playerData,
        resetKind: "reset-levels-and-experience",
        resetAt: RESET_AT,
      },
    })
    actor.start()

    const resetState = await toPromise(actor)

    expect(resetState.head.generation).toBe(2)
    expect(resetState.head.playerData.profile.scheduler).toMatchObject({
      progressGeneration: 1,
      seed: `reset:${RESET_AT}`,
    })
    expect(
      (await store.readAll()).has(BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY),
    ).toBe(true)
  })

  it("deletes the complete durable store through a separate actor", async () => {
    const { store, state } = await createStoreFixture()
    const actor = createActor(deleteAllPlayerDataActor, {
      input: { store, state },
    })
    actor.start()

    await toPromise(actor)

    await expect(store.readAll()).resolves.toEqual(new Map())
  })
})
