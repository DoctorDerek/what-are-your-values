import { describe, expect, it } from "vitest"
import { createActor, toPromise } from "xstate"
import {
  BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
  initializeBattleProfileStore,
  replaceBattleProfileStorePlayerData,
  replaceBattleProfileStorePlayerDataForReset,
} from "./BattleProfileStore"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"
import { createInitialPlayerData } from "./PlayerData"
import {
  applyScopedPlayerDataResetActor,
  deleteAllPlayerDataActor,
} from "./PlayerDataResetActors"
import { createWayvmExport, serializeWayvmExport } from "./WayvmExport"

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
  const preImportBackupBytes = serializeWayvmExport(
    await createWayvmExport({
      exportedAt: CREATED_AT,
      sourceAppVersion: "0.1.0",
      sourceBuild: "reset-actor-test",
      playerData,
    }),
  )
  const state = await replaceBattleProfileStorePlayerData({
    store,
    state: initialState,
    playerData,
    preImportBackupBytes,
    replacedAt: CREATED_AT,
  })

  return { store, state, preImportBackupBytes }
}

describe("Player Data Reset Actors", () => {
  it("derives from the canonical store head and persists one scoped reset generation while retaining recovery records", async () => {
    const { store, state, preImportBackupBytes } = await createStoreFixture()
    const actor = createActor(applyScopedPlayerDataResetActor, {
      input: {
        store,
        state,
        resetKind: "reset-levels-and-experience",
        resetAt: RESET_AT,
      },
    })
    actor.start()

    const resetState = await toPromise(actor)

    expect(resetState.head.generation).toBe(state.head.generation + 1)
    expect(resetState.head.revision).toBe(state.head.revision + 1)
    expect(resetState.head.playerData.profile.scheduler).toMatchObject({
      progressGeneration: 1,
      seed: `reset:${RESET_AT}`,
    })
    expect(
      (await store.readAll()).get(BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY),
    ).toBe(preImportBackupBytes)
  })

  it("propagates a stale reset conflict without changing durable bytes", async () => {
    const { store, state } = await createStoreFixture()
    await replaceBattleProfileStorePlayerDataForReset({
      store,
      state,
      playerData: state.head.playerData,
      replacedAt: RESET_AT,
    })
    const entriesBeforeAttempt = await store.readAll()
    const actor = createActor(applyScopedPlayerDataResetActor, {
      input: {
        store,
        state,
        resetKind: "reset-achievements",
        resetAt: RESET_AT,
      },
    })
    actor.start()

    await expect(toPromise(actor)).rejects.toThrow(
      "wayvm.snapshot.manifest",
    )
    await expect(store.readAll()).resolves.toEqual(entriesBeforeAttempt)
  })

  it("removes every durable record through the separate complete-erasure actor", async () => {
    const { store, state } = await createStoreFixture()
    const actor = createActor(deleteAllPlayerDataActor, {
      input: { store, state },
    })
    actor.start()

    await toPromise(actor)

    await expect(store.readAll()).resolves.toEqual(new Map())
  })
})
