import { describe, expect, it } from "vitest"
import { createActor, toPromise } from "xstate"
import {
  createRecoveryBundleActor,
  deleteUnrecoverablePlayerDataActor,
  replaceUnrecoverablePlayerDataActor,
} from "./BattleProfileRecoveryActors"
import {
  BATTLE_PROFILE_MANIFEST_KEY,
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
} from "./BattleProfileStore"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"
import { createInitialPlayerData } from "./PlayerData"

const RECOVERED_AT = "2026-07-29T12:34:56.000Z"

function createCorruptStore() {
  return createInMemoryDurableStore([
    [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
    [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
  ])
}

describe("Battle Profile Recovery Actors", () => {
  it("prepares a diagnostic download from the exact captured entries", async () => {
    const entries = await createCorruptStore().readAll()
    const actor = createActor(createRecoveryBundleActor, {
      input: {
        entries,
        exportedAt: RECOVERED_AT,
        issue: "Unreadable checkpoints",
        sourceAppVersion: "0.1.0",
        sourceBuild: "recovery-actor-build",
      },
    })
    actor.start()

    const download = await toPromise(actor)

    expect(download.filename).toContain("recovery-2026-07-29")
    expect(download.serialized).toContain("corrupt-checkpoint")
  })

  it("installs validated Player Data over captured corruption", async () => {
    const store = createCorruptStore()
    const entries = await store.readAll()
    const playerData = createInitialPlayerData({
      schedulerSeed: "recovery-actor-import",
      createdAt: RECOVERED_AT,
    })
    const actor = createActor(replaceUnrecoverablePlayerDataActor, {
      input: {
        store,
        entries,
        playerData,
        replacedAt: RECOVERED_AT,
        appVersion: "0.1.0",
      },
    })
    actor.start()

    const state = await toPromise(actor)

    expect(state.head.playerData).toEqual(playerData)
    expect(state.head.generation).toBe(0)
  })

  it("erases captured corruption without requiring a valid manifest", async () => {
    const store = createCorruptStore()
    const actor = createActor(deleteUnrecoverablePlayerDataActor, {
      input: { store, entries: await store.readAll() },
    })
    actor.start()

    await toPromise(actor)

    await expect(store.readAll()).resolves.toEqual(new Map())
  })
})
