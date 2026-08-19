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
  BATTLE_PROFILE_QUARANTINE_KEY,
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
  BATTLE_PROFILE_SNAPSHOT_B_KEY,
  checkpointBattleProfileStoreHead,
  commitBattleProfileStoreEvent,
  deleteAllBattleProfileStoreData,
  deleteUnrecoverableBattleProfileStoreData,
  getBattleProfileJournalKey,
  initializeBattleProfileStore,
  readBattleProfileJournalKeyGeneration,
  replaceBattleProfileStorePlayerData,
  replaceBattleProfileStorePlayerDataForLocalMutation,
  replaceUnrecoverableBattleProfileStorePlayerData,
} from "./BattleProfileStore"
import { DurableStoreConflictError } from "./DurableStoreAdapter"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"
import { projectScheduledPair } from "./PairScheduler"
import { createInitialPlayerData, type PlayerData } from "./PlayerData"
import { createWayvmExport, serializeWayvmExport } from "./WayvmExport"

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

async function createPreImportBackupBytes(
  playerData: PlayerData,
  exportedAt = "2026-07-21T00:01:30.000Z",
) {
  return serializeWayvmExport(
    await createWayvmExport({
      exportedAt,
      sourceAppVersion: "0.1.0",
      sourceBuild: "battle-profile-store-test",
      playerData,
    }),
  )
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

  it("checkpoints the current durable head without changing semantic state", async () => {
    const store = createInMemoryDurableStore()
    const initialState = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "background-checkpoint-seed",
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
    const checkpointedState = await checkpointBattleProfileStoreHead({
      store,
      state: committedState,
      checkpointedAt: "2026-07-21T00:02:00.000Z",
    })
    const entries = await store.readAll()
    const checkpointBytes = entries.get(BATTLE_PROFILE_SNAPSHOT_B_KEY)
    if (!checkpointBytes) {
      throw new Error("The background checkpoint is missing")
    }

    expect(checkpointedState.head).toBe(committedState.head)
    expect(checkpointedState.manifest).toMatchObject({
      activeSlot: "b",
      checkpointGeneration: 1,
      checkpointRevision: 1,
      headGeneration: 1,
      headRevision: 1,
    })
    expect(checkpointedState.journalKeys).toEqual([
      getBattleProfileJournalKey(1),
    ])
    expect(entries.has(getBattleProfileJournalKey(1))).toBe(true)
    await expect(
      decodeBattleProfileCheckpoint(checkpointBytes),
    ).resolves.toMatchObject({
      generation: 1,
      revision: 1,
      createdAt: "2026-07-21T00:00:00.000Z",
      updatedAt: "2026-07-21T00:02:00.000Z",
      playerData: committedState.head.playerData,
    })
  })

  it("prunes journals superseded by the prior checkpoint and then becomes idempotent", async () => {
    const store = createInMemoryDurableStore()
    const initialState = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "repeated-background-checkpoint-seed",
        createdAt: "2026-07-21T00:00:00.000Z",
      }),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const firstCommittedState = await commitBattleProfileStoreEvent({
      store,
      state: initialState,
      event: createChoiceEvent(initialState.head.playerData.profile),
      committedAt: "2026-07-21T00:01:00.000Z",
    })
    const firstCheckpointedState = await checkpointBattleProfileStoreHead({
      store,
      state: firstCommittedState,
      checkpointedAt: "2026-07-21T00:02:00.000Z",
    })
    const secondCommittedState = await commitBattleProfileStoreEvent({
      store,
      state: firstCheckpointedState,
      event: createChoiceEvent(firstCheckpointedState.head.playerData.profile),
      committedAt: "2026-07-21T00:03:00.000Z",
    })
    const secondCheckpointedState = await checkpointBattleProfileStoreHead({
      store,
      state: secondCommittedState,
      checkpointedAt: "2026-07-21T00:04:00.000Z",
    })
    const entriesAfterCheckpoint = await store.readAll()
    const repeatedCheckpointState = await checkpointBattleProfileStoreHead({
      store,
      state: secondCheckpointedState,
      checkpointedAt: "2026-07-21T00:05:00.000Z",
    })

    expect(secondCheckpointedState.manifest).toMatchObject({
      activeSlot: "a",
      checkpointGeneration: 2,
      headGeneration: 2,
    })
    expect(secondCheckpointedState.journalKeys).toEqual([
      getBattleProfileJournalKey(2),
    ])
    expect(entriesAfterCheckpoint.has(getBattleProfileJournalKey(1))).toBe(
      false,
    )
    expect(entriesAfterCheckpoint.has(getBattleProfileJournalKey(2))).toBe(true)
    expect(repeatedCheckpointState).toBe(secondCheckpointedState)
    await expect(store.readAll()).resolves.toEqual(entriesAfterCheckpoint)
  })

  it("rejects a stale background checkpoint without changing durable bytes", async () => {
    const store = createInMemoryDurableStore()
    const initialState = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "stale-background-checkpoint-seed",
        createdAt: "2026-07-21T00:00:00.000Z",
      }),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const staleState = await commitBattleProfileStoreEvent({
      store,
      state: initialState,
      event: createChoiceEvent(initialState.head.playerData.profile),
      committedAt: "2026-07-21T00:01:00.000Z",
    })
    await commitBattleProfileStoreEvent({
      store,
      state: staleState,
      event: createChoiceEvent(staleState.head.playerData.profile),
      committedAt: "2026-07-21T00:02:00.000Z",
    })
    const currentEntries = await store.readAll()

    await expect(
      checkpointBattleProfileStoreHead({
        store,
        state: staleState,
        checkpointedAt: "2026-07-21T00:03:00.000Z",
      }),
    ).rejects.toBeInstanceOf(DurableStoreConflictError)
    await expect(store.readAll()).resolves.toEqual(currentEntries)
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
    const preImportBackupBytes = await createPreImportBackupBytes(
      committedState.head.playerData,
    )
    const replacedState = await replaceBattleProfileStorePlayerData({
      store,
      state: committedState,
      playerData: importedPlayerData,
      preImportBackupBytes,
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
      preImportBackupBytes,
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
    const preImportBackupBytes = await createPreImportBackupBytes(
      initialState.head.playerData,
    )

    await expect(
      replaceBattleProfileStorePlayerData({
        store,
        state: initialState,
        playerData: createInitialPlayerData({
          schedulerSeed: "rejected-import-seed",
          createdAt: "2026-07-20T00:00:00.000Z",
        }),
        preImportBackupBytes,
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
    const preImportBackupBytes = await createPreImportBackupBytes(
      initialState.head.playerData,
    )
    const replacedState = await replaceBattleProfileStorePlayerData({
      store,
      state: initialState,
      playerData: importedPlayerData,
      preImportBackupBytes,
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

  it("atomically checkpoints a scoped reset while retaining existing recovery records", async () => {
    const store = createInMemoryDurableStore()
    const initialState = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "reset-store-initial",
        createdAt: createCommitTimestamp(0),
      }),
      createdAt: createCommitTimestamp(0),
      appVersion: "0.1.0",
    })
    const preImportBackupBytes = await createPreImportBackupBytes(
      initialState.head.playerData,
    )
    const importedState = await replaceBattleProfileStorePlayerData({
      store,
      state: initialState,
      playerData: createInitialPlayerData({
        schedulerSeed: "reset-store-imported",
        createdAt: createCommitTimestamp(1),
      }),
      preImportBackupBytes,
      replacedAt: createCommitTimestamp(1),
    })
    const committedState = await commitBattleProfileStoreEvent({
      store,
      state: importedState,
      event: createChoiceEvent(importedState.head.playerData.profile),
      committedAt: createCommitTimestamp(2),
    })
    await store.compareAndSwapVerified({
      expectedEntries: [
        [BATTLE_PROFILE_QUARANTINE_KEY, null],
        ["wayvm.future-record", null],
      ],
      putEntries: [
        [BATTLE_PROFILE_QUARANTINE_KEY, "retained-quarantine"],
        ["wayvm.future-record", "retained-future-player-data"],
      ],
      deleteKeys: [],
    })
    const resetPlayerData = createInitialPlayerData({
      schedulerSeed: "reset-store-candidate",
      createdAt: createCommitTimestamp(3),
    })

    const resetState =
      await replaceBattleProfileStorePlayerDataForLocalMutation({
        store,
        state: committedState,
        playerData: resetPlayerData,
        replacedAt: createCommitTimestamp(3),
      })
    const entries = await store.readAll()

    expect(resetState.head).toMatchObject({
      generation: 3,
      revision: 3,
      playerData: resetPlayerData,
    })
    expect(resetState.journalKeys).toEqual([])
    expect(entries.has(getBattleProfileJournalKey(2))).toBe(false)
    expect(entries.get(BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY)).toBe(
      preImportBackupBytes,
    )
    expect(entries.get(BATTLE_PROFILE_QUARANTINE_KEY)).toBe(
      "retained-quarantine",
    )
    expect(entries.get("wayvm.future-record")).toBe(
      "retained-future-player-data",
    )
  })

  it("does not invent a pre-import backup during a scoped reset", async () => {
    const store = createInMemoryDurableStore()
    const state = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "reset-without-backup-initial",
        createdAt: createCommitTimestamp(0),
      }),
      createdAt: createCommitTimestamp(0),
      appVersion: "0.1.0",
    })

    await replaceBattleProfileStorePlayerDataForLocalMutation({
      store,
      state,
      playerData: createInitialPlayerData({
        schedulerSeed: "reset-without-backup-candidate",
        createdAt: createCommitTimestamp(1),
      }),
      replacedAt: createCommitTimestamp(1),
    })

    expect(
      (await store.readAll()).has(BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY),
    ).toBe(false)
  })

  it("deletes every existing durable player-data record from the current manifest identity", async () => {
    const store = createInMemoryDurableStore()
    const initialState = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "delete-all-store-initial",
        createdAt: createCommitTimestamp(0),
      }),
      createdAt: createCommitTimestamp(0),
      appVersion: "0.1.0",
    })
    const committedState = await commitBattleProfileStoreEvent({
      store,
      state: initialState,
      event: createChoiceEvent(initialState.head.playerData.profile),
      committedAt: createCommitTimestamp(1),
    })
    const preImportBackupBytes = await createPreImportBackupBytes(
      committedState.head.playerData,
    )
    const importedState = await replaceBattleProfileStorePlayerData({
      store,
      state: committedState,
      playerData: createInitialPlayerData({
        schedulerSeed: "delete-all-store-imported",
        createdAt: createCommitTimestamp(2),
      }),
      preImportBackupBytes,
      replacedAt: createCommitTimestamp(2),
    })
    const currentState = await commitBattleProfileStoreEvent({
      store,
      state: importedState,
      event: createChoiceEvent(importedState.head.playerData.profile),
      committedAt: createCommitTimestamp(3),
    })
    await store.compareAndSwapVerified({
      expectedEntries: [
        [BATTLE_PROFILE_QUARANTINE_KEY, null],
        ["wayvm.future-record", null],
      ],
      putEntries: [
        [BATTLE_PROFILE_QUARANTINE_KEY, "corrupt-player-data"],
        ["wayvm.future-record", "future-player-data"],
      ],
      deleteKeys: [],
    })

    await deleteAllBattleProfileStoreData({ store, state: currentState })

    await expect(store.readAll()).resolves.toEqual(new Map())
  })

  it("rejects scoped replacement and complete erasure from stale manifest identities without changing bytes", async () => {
    const store = createInMemoryDurableStore()
    const staleState = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "stale-reset-store",
        createdAt: createCommitTimestamp(0),
      }),
      createdAt: createCommitTimestamp(0),
      appVersion: "0.1.0",
    })
    const currentState =
      await replaceBattleProfileStorePlayerDataForLocalMutation({
        store,
        state: staleState,
        playerData: createInitialPlayerData({
          schedulerSeed: "current-reset-store",
          createdAt: createCommitTimestamp(1),
        }),
        replacedAt: createCommitTimestamp(1),
      })
    const entriesBeforeAttempts = await store.readAll()

    await expect(
      replaceBattleProfileStorePlayerDataForLocalMutation({
        store,
        state: staleState,
        playerData: createInitialPlayerData({
          schedulerSeed: "rejected-reset-store",
          createdAt: createCommitTimestamp(2),
        }),
        replacedAt: createCommitTimestamp(2),
      }),
    ).rejects.toBeInstanceOf(DurableStoreConflictError)
    await expect(
      deleteAllBattleProfileStoreData({ store, state: staleState }),
    ).rejects.toBeInstanceOf(DurableStoreConflictError)
    await expect(store.readAll()).resolves.toEqual(entriesBeforeAttempts)
    expect(currentState.head.generation).toBe(1)
  })

  it("rejects complete erasure when the expected manifest has disappeared", async () => {
    const store = createInMemoryDurableStore()
    const state = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "missing-erasure-manifest",
        createdAt: createCommitTimestamp(0),
      }),
      createdAt: createCommitTimestamp(0),
      appVersion: "0.1.0",
    })
    await store.compareAndSwapVerified({
      expectedEntries: [[BATTLE_PROFILE_MANIFEST_KEY, state.manifestBytes]],
      putEntries: [],
      deleteKeys: [BATTLE_PROFILE_MANIFEST_KEY],
    })
    const orphanedEntries = await store.readAll()

    await expect(
      deleteAllBattleProfileStoreData({ store, state }),
    ).rejects.toBeInstanceOf(DurableStoreConflictError)
    await expect(store.readAll()).resolves.toEqual(orphanedEntries)
  })

  it("rejects malformed pre-import backup bytes without changing durable state", async () => {
    const store = createInMemoryDurableStore()
    const state = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "malformed-backup-seed",
        createdAt: "2026-07-21T00:00:00.000Z",
      }),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const entriesBeforeAttempt = await store.readAll()

    await expect(
      replaceBattleProfileStorePlayerData({
        store,
        state,
        playerData: createInitialPlayerData({
          schedulerSeed: "malformed-backup-import-seed",
          createdAt: "2026-07-20T00:00:00.000Z",
        }),
        preImportBackupBytes: "not-json",
        replacedAt: "2026-07-21T00:01:00.000Z",
      }),
    ).rejects.toThrow("Persisted JSON is malformed")
    await expect(store.readAll()).resolves.toEqual(entriesBeforeAttempt)
  })

  it("rejects a valid backup of different Player Data without changing durable state", async () => {
    const store = createInMemoryDurableStore()
    const state = await initializeBattleProfileStore({
      store,
      playerData: createInitialPlayerData({
        schedulerSeed: "mismatched-backup-current-seed",
        createdAt: "2026-07-21T00:00:00.000Z",
      }),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const mismatchedBackupBytes = await createPreImportBackupBytes(
      createInitialPlayerData({
        schedulerSeed: "mismatched-backup-other-seed",
        createdAt: "2026-07-21T00:00:00.000Z",
      }),
    )
    const entriesBeforeAttempt = await store.readAll()

    await expect(
      replaceBattleProfileStorePlayerData({
        store,
        state,
        playerData: createInitialPlayerData({
          schedulerSeed: "mismatched-backup-import-seed",
          createdAt: "2026-07-20T00:00:00.000Z",
        }),
        preImportBackupBytes: mismatchedBackupBytes,
        replacedAt: "2026-07-21T00:01:00.000Z",
      }),
    ).rejects.toThrow("Pre-import backup does not match current Player Data")
    await expect(store.readAll()).resolves.toEqual(entriesBeforeAttempt)
  })

  it.each([
    {
      caseName: "non-integer generation",
      generation: Number.NaN,
      revision: 0,
      label: "Store generation",
    },
    {
      caseName: "negative generation",
      generation: -1,
      revision: 0,
      label: "Store generation",
    },
    {
      caseName: "maximum generation",
      generation: Number.MAX_SAFE_INTEGER,
      revision: 0,
      label: "Store generation",
    },
    {
      caseName: "non-integer revision",
      generation: 0,
      revision: Number.NaN,
      label: "Store revision",
    },
    {
      caseName: "negative revision",
      generation: 0,
      revision: -1,
      label: "Store revision",
    },
    {
      caseName: "maximum revision",
      generation: 0,
      revision: Number.MAX_SAFE_INTEGER,
      label: "Store revision",
    },
  ])(
    "rejects an unsafe $caseName before changing durable state",
    async ({ generation, revision, label }) => {
      const store = createInMemoryDurableStore()
      const state = await initializeBattleProfileStore({
        store,
        playerData: createInitialPlayerData({
          schedulerSeed: "unsafe-replacement-identity-seed",
          createdAt: "2026-07-21T00:00:00.000Z",
        }),
        createdAt: "2026-07-21T00:00:00.000Z",
        appVersion: "0.1.0",
      })
      const preImportBackupBytes = await createPreImportBackupBytes(
        state.head.playerData,
      )
      const entriesBeforeAttempt = await store.readAll()

      await expect(
        replaceBattleProfileStorePlayerData({
          store,
          state: {
            ...state,
            head: {
              ...state.head,
              generation,
              revision,
            },
          },
          playerData: createInitialPlayerData({
            schedulerSeed: "unsafe-replacement-import-seed",
            createdAt: "2026-07-20T00:00:00.000Z",
          }),
          preImportBackupBytes,
          replacedAt: "2026-07-21T00:01:00.000Z",
        }),
      ).rejects.toThrow(`${label} cannot be incremented safely`)
      await expect(store.readAll()).resolves.toEqual(entriesBeforeAttempt)
    },
  )
  it("atomically replaces captured unrecoverable bytes with one validated generation-zero checkpoint", async () => {
    const store = createInMemoryDurableStore([
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      ["wayvm.future-record", "future-corrupt-data"],
    ])
    const entries = await store.readAll()
    const playerData = createInitialPlayerData({
      schedulerSeed: "explicit-recovery-import",
      createdAt: createCommitTimestamp(0),
    })

    const recoveredState =
      await replaceUnrecoverableBattleProfileStorePlayerData({
        store,
        entries,
        playerData,
        replacedAt: createCommitTimestamp(1),
        appVersion: "0.1.0",
      })
    const recoveredEntries = await store.readAll()

    expect(recoveredState.head).toEqual({
      generation: 0,
      revision: 0,
      playerData,
    })
    expect(Array.from(recoveredEntries.keys()).sort()).toEqual(
      [BATTLE_PROFILE_MANIFEST_KEY, BATTLE_PROFILE_SNAPSHOT_A_KEY].sort(),
    )
    await expect(
      decodeBattleProfileCheckpoint(
        recoveredEntries.get(BATTLE_PROFILE_SNAPSHOT_A_KEY) ?? "",
      ),
    ).resolves.toMatchObject({ playerData })
  })

  it("rejects explicit recovery replacement when captured corrupt bytes become stale", async () => {
    const store = createInMemoryDurableStore([
      [BATTLE_PROFILE_MANIFEST_KEY, "first-corrupt-manifest"],
    ])
    const entries = await store.readAll()
    await store.compareAndSwapVerified({
      expectedEntries: [
        [BATTLE_PROFILE_MANIFEST_KEY, "first-corrupt-manifest"],
      ],
      putEntries: [[BATTLE_PROFILE_MANIFEST_KEY, "second-corrupt-manifest"]],
      deleteKeys: [],
    })
    const currentEntries = await store.readAll()

    await expect(
      replaceUnrecoverableBattleProfileStorePlayerData({
        store,
        entries,
        playerData: createInitialPlayerData({
          schedulerSeed: "stale-explicit-recovery",
          createdAt: createCommitTimestamp(0),
        }),
        replacedAt: createCommitTimestamp(1),
        appVersion: "0.1.0",
      }),
    ).rejects.toBeInstanceOf(DurableStoreConflictError)
    await expect(store.readAll()).resolves.toEqual(currentEntries)
  })

  it("deletes exactly the captured unrecoverable records", async () => {
    const store = createInMemoryDurableStore([
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
    ])
    const entries = await store.readAll()

    await deleteUnrecoverableBattleProfileStoreData({ store, entries })

    await expect(store.readAll()).resolves.toEqual(new Map())
  })

  it("rejects recovery deletion when captured corrupt bytes have changed", async () => {
    const store = createInMemoryDurableStore([
      [BATTLE_PROFILE_MANIFEST_KEY, "first-corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "first-corrupt-checkpoint"],
    ])
    const entries = await store.readAll()
    await store.compareAndSwapVerified({
      expectedEntries: Array.from(entries),
      putEntries: [[BATTLE_PROFILE_SNAPSHOT_A_KEY, "later-corrupt-checkpoint"]],
      deleteKeys: [],
    })
    const currentEntries = await store.readAll()

    await expect(
      deleteUnrecoverableBattleProfileStoreData({ store, entries }),
    ).rejects.toBeInstanceOf(DurableStoreConflictError)
    await expect(store.readAll()).resolves.toEqual(currentEntries)
  })
})
