import { describe, expect, it } from "vitest"
import { applyBattleChoice, createInitialBattleProfile } from "./BattleProfile"
import { decodeBattleProfileCheckpoint } from "./BattleProfileCheckpoint"
import { createBattleChoiceEvent } from "./BattleProfileEvent"
import {
  decodeBattleProfileManifest,
  MAX_JOURNAL_RECORDS_BEFORE_CHECKPOINT,
} from "./BattleProfileManifest"
import {
  BATTLE_PROFILE_JOURNAL_KEY_PREFIX,
  BATTLE_PROFILE_MANIFEST_KEY,
  BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
  BATTLE_PROFILE_SNAPSHOT_B_KEY,
  commitBattleProfileStoreEvent,
  getBattleProfileJournalKey,
  initializeBattleProfileStore,
  readBattleProfileJournalKeyGeneration,
  replaceBattleProfileStorePlayerData,
} from "./BattleProfileStore"
import { DurableStoreConflictError } from "./DurableStoreAdapter"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"
import { projectScheduledPair } from "./PairScheduler"
import { createInitialPlayerData } from "./PlayerData"

function createChoiceEvent(
  profile: ReturnType<typeof createInitialBattleProfile>,
) {
  const [winnerId] = projectScheduledPair(
    profile.activeDeck,
    profile.scheduler,
  ).pair

  return createBattleChoiceEvent(
    applyBattleChoice({
      profile,
      winnerId,
      expectedScheduler: profile.scheduler,
    }),
  )
}

function createCommitTimestamp(generation: number) {
  return new Date(Date.UTC(2026, 6, 21, 0, generation)).toISOString()
}

describe("Battle Profile Store", () => {
  it("accepts only canonical positive journal-generation keys", () => {
    expect(
      readBattleProfileJournalKeyGeneration(
        `${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}42`,
      ),
    ).toBe(42)
    expect(() => getBattleProfileJournalKey(0)).toThrow(
      "Invalid Battle Profile journal generation",
    )
    expect(() =>
      readBattleProfileJournalKeyGeneration("not-a-journal-key"),
    ).toThrow("Invalid Battle Profile journal key")
    expect(() =>
      readBattleProfileJournalKeyGeneration(
        `${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}0`,
      ),
    ).toThrow("Invalid Battle Profile journal key")
    expect(() =>
      readBattleProfileJournalKeyGeneration(
        `${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}042`,
      ),
    ).toThrow("Invalid Battle Profile journal key")
  })

  it("atomically initializes slot A and its generation-zero manifest", async () => {
    const store = createInMemoryDurableStore()
    const playerData = createInitialPlayerData({
      schedulerSeed: "store-initialization-seed",
      createdAt: "2026-07-21T00:00:00.000Z",
    })
    const state = await initializeBattleProfileStore({
      store,
      playerData,
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
    ).resolves.toMatchObject({ generation: 0, revision: 0, playerData })
    expect(decodeBattleProfileManifest(manifestBytes)).toEqual(state.manifest)
    expect(entries.has(BATTLE_PROFILE_SNAPSHOT_B_KEY)).toBe(false)
    expect(state.head).toEqual({ generation: 0, revision: 0, playerData })
  })

  it("refuses to initialize over an orphaned checkpoint", async () => {
    const store = createInMemoryDurableStore([
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "unreadable-existing-bytes"],
    ])

    await expect(
      initializeBattleProfileStore({
        store,
        playerData: createInitialPlayerData({
          schedulerSeed: "orphaned-store-seed",
          createdAt: "2026-07-21T00:00:00.000Z",
        }),
        createdAt: "2026-07-21T00:00:00.000Z",
        appVersion: "0.1.0",
      }),
    ).rejects.toBeInstanceOf(DurableStoreConflictError)
    await expect(store.readAll()).resolves.toEqual(
      new Map([[BATTLE_PROFILE_SNAPSHOT_A_KEY, "unreadable-existing-bytes"]]),
    )
  })

  it("appends one verified event and rejects a stale competing writer", async () => {
    const store = createInMemoryDurableStore()
    const initialState = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "store-commit-seed",
        createdAt: "2026-07-21T00:00:00.000Z",
      }),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const event = createChoiceEvent(initialState.head.playerData.profile)
    const committedState = await commitBattleProfileStoreEvent({
      store,
      state: initialState,
      event,
      committedAt: "2026-07-21T00:01:00.000Z",
    })
    const entries = await store.readAll()

    expect(entries.has(`${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}1`)).toBe(true)
    expect(committedState.head).toMatchObject({ generation: 1, revision: 1 })
    expect(committedState.manifest).toMatchObject({
      activeSlot: "a",
      checkpointGeneration: 0,
      headGeneration: 1,
    })
    await expect(
      commitBattleProfileStoreEvent({
        store,
        state: initialState,
        event,
        committedAt: "2026-07-21T00:01:00.000Z",
      }),
    ).rejects.toBeInstanceOf(DurableStoreConflictError)
  })

  it("rotates checkpoint slots and retains only journals required by the fallback", async () => {
    const store = createInMemoryDurableStore()
    let state = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "store-rotation-seed",
        createdAt: "2026-07-21T00:00:00.000Z",
      }),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })

    for (
      let generation = 1;
      generation <= MAX_JOURNAL_RECORDS_BEFORE_CHECKPOINT * 2;
      generation += 1
    ) {
      state = await commitBattleProfileStoreEvent({
        store,
        state,
        event: createChoiceEvent(state.head.playerData.profile),
        committedAt: createCommitTimestamp(generation),
      })

      if (generation === MAX_JOURNAL_RECORDS_BEFORE_CHECKPOINT) {
        expect(state.manifest).toMatchObject({
          activeSlot: "b",
          checkpointGeneration: generation,
          headGeneration: generation,
        })
      }
    }

    const entries = await store.readAll()
    const activeCheckpointBytes = entries.get(BATTLE_PROFILE_SNAPSHOT_A_KEY)
    if (!activeCheckpointBytes) {
      throw new Error("The rotated active checkpoint is missing")
    }
    const activeCheckpoint = await decodeBattleProfileCheckpoint(
      activeCheckpointBytes,
    )

    expect(state.manifest).toMatchObject({
      activeSlot: "a",
      checkpointGeneration: 64,
      headGeneration: 64,
    })
    expect(activeCheckpoint).toMatchObject({
      generation: 64,
      revision: 64,
      playerData: state.head.playerData,
    })
    expect(entries.has(BATTLE_PROFILE_SNAPSHOT_B_KEY)).toBe(true)
    expect(entries.has(`${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}32`)).toBe(false)
    expect(entries.has(`${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}33`)).toBe(true)
    expect(entries.has(`${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}64`)).toBe(true)
    expect(state.journalKeys).toHaveLength(32)
  })

  it("atomically replaces PlayerData through the inactive checkpoint and preserves the prior slot", async () => {
    const store = createInMemoryDurableStore()
    const initialState = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "pre-import-seed",
        createdAt: "2026-07-21T00:00:00.000Z",
      }),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const committedState = await commitBattleProfileStoreEvent({
      store,
      state: initialState,
      event: createChoiceEvent(initialState.head.playerData.profile),
      committedAt: "2026-07-21T00:01:00.000Z",
    })
    const entriesBeforeImport = await store.readAll()
    const importedPlayerData = createInitialPlayerData({
      schedulerSeed: "imported-seed",
      createdAt: "2026-07-20T00:00:00.000Z",
    })
    const replacedState = await replaceBattleProfileStorePlayerData({
      store,
      state: committedState,
      playerData: importedPlayerData,
      preImportBackupBytes: "verified-pre-import-backup",
      replacedAt: "2026-07-21T00:02:00.000Z",
    })
    const entriesAfterImport = await store.readAll()

    expect(replacedState.head).toEqual({
      generation: 2,
      revision: 2,
      playerData: importedPlayerData,
    })
    expect(replacedState.manifest).toMatchObject({
      activeSlot: "b",
      checkpointGeneration: 2,
      headGeneration: 2,
    })
    expect(replacedState.journalKeys).toEqual([])
    expect(entriesAfterImport.get(BATTLE_PROFILE_SNAPSHOT_A_KEY)).toBe(
      entriesBeforeImport.get(BATTLE_PROFILE_SNAPSHOT_A_KEY),
    )
    expect(entriesAfterImport.has(getBattleProfileJournalKey(1))).toBe(false)
    expect(entriesAfterImport.get(BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY)).toBe(
      "verified-pre-import-backup",
    )
    await expect(
      decodeBattleProfileCheckpoint(
        entriesAfterImport.get(BATTLE_PROFILE_SNAPSHOT_B_KEY) ?? "",
      ),
    ).resolves.toMatchObject({ playerData: importedPlayerData })
  })

  it("rejects stale replacements without changing any durable bytes", async () => {
    const store = createInMemoryDurableStore()
    const initialState = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "stale-import-seed",
        createdAt: "2026-07-21T00:00:00.000Z",
      }),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const currentState = await commitBattleProfileStoreEvent({
      store,
      state: initialState,
      event: createChoiceEvent(initialState.head.playerData.profile),
      committedAt: "2026-07-21T00:01:00.000Z",
    })
    const entriesBeforeAttempt = await store.readAll()

    await expect(
      replaceBattleProfileStorePlayerData({
        store,
        state: initialState,
        playerData: createInitialPlayerData({
          schedulerSeed: "rejected-import-seed",
          createdAt: "2026-07-20T00:00:00.000Z",
        }),
        preImportBackupBytes: "rejected-pre-import-backup",
        replacedAt: "2026-07-21T00:02:00.000Z",
      }),
    ).rejects.toBeInstanceOf(DurableStoreConflictError)
    await expect(store.readAll()).resolves.toEqual(entriesBeforeAttempt)
    expect(currentState.head.generation).toBe(1)
  })

  it("continues the monotonic journal after an imported checkpoint", async () => {
    const store = createInMemoryDurableStore()
    const initialState = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "before-continuation-import-seed",
        createdAt: "2026-07-21T00:00:00.000Z",
      }),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const importedPlayerData = createInitialPlayerData({
      schedulerSeed: "continued-import-seed",
      createdAt: "2026-07-20T00:00:00.000Z",
    })
    const replacedState = await replaceBattleProfileStorePlayerData({
      store,
      state: initialState,
      playerData: importedPlayerData,
      preImportBackupBytes: "continued-pre-import-backup",
      replacedAt: "2026-07-21T00:01:00.000Z",
    })
    const committedState = await commitBattleProfileStoreEvent({
      store,
      state: replacedState,
      event: createChoiceEvent(replacedState.head.playerData.profile),
      committedAt: "2026-07-21T00:02:00.000Z",
    })

    expect(committedState.head).toMatchObject({
      generation: 2,
      revision: 2,
      playerData: {
        achievements: {
          progress: { lifetimeBattleCount: 1 },
        },
      },
    })
    expect((await store.readAll()).has(getBattleProfileJournalKey(2))).toBe(
      true,
    )
  })
})
