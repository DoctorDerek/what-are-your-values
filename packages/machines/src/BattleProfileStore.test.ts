import { describe, expect, it } from "vitest"
import { createInitialBattleProfile } from "./BattleProfile"
import { decodeBattleProfileCheckpoint } from "./BattleProfileCheckpoint"
import { decodeBattleProfileManifest } from "./BattleProfileManifest"
import {
  BATTLE_PROFILE_MANIFEST_KEY,
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
  BATTLE_PROFILE_SNAPSHOT_B_KEY,
  initializeBattleProfileStore,
} from "./BattleProfileStore"
import { DurableStoreConflictError } from "./DurableStoreAdapter"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"

describe("Battle Profile Store", () => {
  it("atomically initializes slot A and its generation-zero manifest", async () => {
    const store = createInMemoryDurableStore()
    const profile = createInitialBattleProfile("store-initialization-seed")
    const state = await initializeBattleProfileStore({
      store,
      profile,
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const entries = await store.readAll()
    const checkpointBytes = entries.get(BATTLE_PROFILE_SNAPSHOT_A_KEY)
    const manifestBytes = entries.get(BATTLE_PROFILE_MANIFEST_KEY)
    if (!checkpointBytes || !manifestBytes) {
      throw new Error("The initialized durable records are missing")
    }

    await expect(
      decodeBattleProfileCheckpoint(checkpointBytes),
    ).resolves.toMatchObject({ generation: 0, revision: 0, profile })
    expect(decodeBattleProfileManifest(manifestBytes)).toEqual(state.manifest)
    expect(entries.has(BATTLE_PROFILE_SNAPSHOT_B_KEY)).toBe(false)
    expect(state.head).toEqual({ generation: 0, revision: 0, profile })
  })

  it("refuses to initialize over an orphaned checkpoint", async () => {
    const store = createInMemoryDurableStore([
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "unreadable-existing-bytes"],
    ])

    await expect(
      initializeBattleProfileStore({
        store,
        profile: createInitialBattleProfile("orphaned-store-seed"),
        createdAt: "2026-07-21T00:00:00.000Z",
        appVersion: "0.1.0",
      }),
    ).rejects.toBeInstanceOf(DurableStoreConflictError)
    await expect(store.readAll()).resolves.toEqual(
      new Map([[BATTLE_PROFILE_SNAPSHOT_A_KEY, "unreadable-existing-bytes"]]),
    )
  })
})
