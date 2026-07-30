import { describe, expect, it } from "vitest"
import { applyBattleChoice, createInitialBattleProfile } from "./BattleProfile"
import { createBattleChoiceEvent } from "./BattleProfileEvent"
import { hydrateBattleProfileStore } from "./BattleProfileHydration"
import {
  createBattleProfileManifest,
  serializeBattleProfileManifest,
} from "./BattleProfileManifest"
import {
  BATTLE_PROFILE_JOURNAL_KEY_PREFIX,
  BATTLE_PROFILE_MANIFEST_KEY,
  BATTLE_PROFILE_QUARANTINE_KEY,
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
  BATTLE_PROFILE_SNAPSHOT_B_KEY,
  commitBattleProfileStoreEvent,
  getBattleProfileJournalKey,
  initializeBattleProfileStore,
} from "./BattleProfileStore"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"
import { projectScheduledPair } from "./PairScheduler"
import { MAX_PERSISTED_JSON_BYTES } from "./PersistedJson"
import { createInitialPlayerData } from "./PlayerData"

function createTestPlayerData(schedulerSeed: string) {
  return createInitialPlayerData({
    schedulerSeed,
    createdAt: "2026-07-21T00:00:00.000Z",
  })
}

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

async function createCommittedStore(seed: string, generationCount: number) {
  const store = createInMemoryDurableStore()
  let state = await initializeBattleProfileStore({
    store,
    playerData: createTestPlayerData(seed),
    createdAt: "2026-07-21T00:00:00.000Z",
    appVersion: "0.1.0",
  })

  for (let generation = 1; generation <= generationCount; generation += 1) {
    state = await commitBattleProfileStoreEvent({
      store,
      state,
      event: createChoiceEvent(state.head.playerData.profile),
      committedAt: new Date(Date.UTC(2026, 6, 21, 0, generation)).toISOString(),
    })
  }

  return { store, state }
}

describe("Battle Profile Hydration", () => {
  it("reports an untouched store as empty", async () => {
    await expect(
      hydrateBattleProfileStore({
        store: createInMemoryDurableStore(),
        appVersion: "0.1.0",
      }),
    ).resolves.toEqual({ status: "empty" })
  })

  it("repairs a missing manifest from a readable checkpoint", async () => {
    const store = createInMemoryDurableStore()
    await initializeBattleProfileStore({
      store,
      playerData: createTestPlayerData("missing-manifest-seed"),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const entries = await store.readAll()
    const manifestBytes = entries.get(BATTLE_PROFILE_MANIFEST_KEY)
    if (!manifestBytes) {
      throw new Error("The manifest fixture is missing")
    }
    await store.compareAndSwapVerified({
      expectedEntries: [[BATTLE_PROFILE_MANIFEST_KEY, manifestBytes]],
      putEntries: [],
      deleteKeys: [BATTLE_PROFILE_MANIFEST_KEY],
    })

    const result = await hydrateBattleProfileStore({
      store,
      appVersion: "0.2.0",
    })

    expect(result).toMatchObject({
      status: "ready",
      state: { head: { generation: 0, revision: 0 } },
      recoveryNotice: expect.stringContaining(
        "Battle Profile manifest is missing",
      ),
    })
    expect(
      (await store.readAll()).get(BATTLE_PROFILE_MANIFEST_KEY),
    ).toBeTruthy()
  })

  it("reconstructs the manifest head from its active checkpoint and journals", async () => {
    const { store, state } = await createCommittedStore("hydration-seed", 40)

    await expect(
      hydrateBattleProfileStore({ store, appVersion: "0.2.0" }),
    ).resolves.toEqual({
      status: "ready",
      state: { ...state, appVersion: "0.2.0" },
    })
  })

  it("recovers the newest contiguous checkpoint when a journal is missing", async () => {
    const store = createInMemoryDurableStore()
    let state = await initializeBattleProfileStore({
      store,
      playerData: createTestPlayerData("missing-journal-seed"),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    state = await commitBattleProfileStoreEvent({
      store,
      state,
      event: createChoiceEvent(state.head.playerData.profile),
      committedAt: "2026-07-21T00:01:00.000Z",
    })
    const beforeDamage = await store.readAll()
    await store.compareAndSwapVerified({
      expectedEntries: [
        [
          `${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}1`,
          beforeDamage.get(`${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}1`) ?? null,
        ],
      ],
      putEntries: [],
      deleteKeys: [`${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}1`],
    })
    const result = await hydrateBattleProfileStore({
      store,
      appVersion: "0.1.0",
    })

    expect(result).toMatchObject({
      status: "ready",
      state: {
        head: { generation: 0, revision: 0 },
        manifest: { headGeneration: 0, headRevision: 0 },
      },
    })
    expect(result).toHaveProperty("recoveryNotice")
  })

  it("rebuilds a corrupt manifest from the newest valid checkpoint", async () => {
    const store = createInMemoryDurableStore()
    await initializeBattleProfileStore({
      store,
      playerData: createTestPlayerData("corrupt-manifest-seed"),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const entries = await store.readAll()
    const manifestBytes = entries.get(BATTLE_PROFILE_MANIFEST_KEY)
    if (!manifestBytes) {
      throw new Error("The manifest fixture is missing")
    }
    await store.compareAndSwapVerified({
      expectedEntries: [[BATTLE_PROFILE_MANIFEST_KEY, manifestBytes]],
      putEntries: [[BATTLE_PROFILE_MANIFEST_KEY, "corrupt"]],
      deleteKeys: [],
    })

    await expect(
      hydrateBattleProfileStore({ store, appVersion: "0.1.0" }),
    ).resolves.toMatchObject({
      status: "ready",
      state: { head: { generation: 0, revision: 0 } },
    })
    expect((await store.readAll()).get(BATTLE_PROFILE_MANIFEST_KEY)).not.toBe(
      "corrupt",
    )
  })

  it("restores a corrupt active slot from the fallback and quarantines its bytes", async () => {
    const { store } = await createCommittedStore("fallback-recovery-seed", 40)
    const entries = await store.readAll()
    const activeCheckpointBytes = entries.get(BATTLE_PROFILE_SNAPSHOT_B_KEY)
    if (!activeCheckpointBytes) {
      throw new Error("The active checkpoint fixture is missing")
    }
    await store.compareAndSwapVerified({
      expectedEntries: [[BATTLE_PROFILE_SNAPSHOT_B_KEY, activeCheckpointBytes]],
      putEntries: [[BATTLE_PROFILE_SNAPSHOT_B_KEY, "corrupt-checkpoint"]],
      deleteKeys: [],
    })

    const result = await hydrateBattleProfileStore({
      store,
      appVersion: "0.2.0",
    })
    const recoveredEntries = await store.readAll()

    expect(result).toMatchObject({
      status: "ready",
      state: {
        head: { generation: 40, revision: 40 },
        manifest: {
          activeSlot: "b",
          checkpointGeneration: 40,
          headGeneration: 40,
        },
      },
    })
    expect(recoveredEntries.get(BATTLE_PROFILE_QUARANTINE_KEY)).toBe(
      "corrupt-checkpoint",
    )
    expect(recoveredEntries.get(BATTLE_PROFILE_SNAPSHOT_A_KEY)).toBe(
      entries.get(BATTLE_PROFILE_SNAPSHOT_A_KEY),
    )
  })

  it("repairs a missing active checkpoint from the fallback slot", async () => {
    const { store } = await createCommittedStore(
      "missing-active-checkpoint-seed",
      32,
    )
    const entries = await store.readAll()
    const snapshotBBytes = entries.get(BATTLE_PROFILE_SNAPSHOT_B_KEY)
    if (!snapshotBBytes) {
      throw new Error("The active checkpoint fixture is missing")
    }
    await store.compareAndSwapVerified({
      expectedEntries: [[BATTLE_PROFILE_SNAPSHOT_B_KEY, snapshotBBytes]],
      putEntries: [],
      deleteKeys: [BATTLE_PROFILE_SNAPSHOT_B_KEY],
    })

    const result = await hydrateBattleProfileStore({
      store,
      appVersion: "0.2.0",
    })

    expect(result).toMatchObject({
      status: "ready",
      state: {
        head: { generation: 32, revision: 32 },
        manifest: {
          activeSlot: "b",
          checkpointGeneration: 32,
          headGeneration: 32,
        },
      },
      recoveryNotice: expect.stringContaining(
        "Active Battle Profile checkpoint is missing",
      ),
    })
  })

  it("requires explicit recovery when neither checkpoint is readable", async () => {
    const store = createInMemoryDurableStore()
    await initializeBattleProfileStore({
      store,
      playerData: createTestPlayerData("unreadable-slots-seed"),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const entries = await store.readAll()
    const snapshotABytes = entries.get(BATTLE_PROFILE_SNAPSHOT_A_KEY)
    if (!snapshotABytes) {
      throw new Error("The slot A fixture is missing")
    }
    await store.compareAndSwapVerified({
      expectedEntries: [[BATTLE_PROFILE_SNAPSHOT_A_KEY, snapshotABytes]],
      putEntries: [[BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-a"]],
      deleteKeys: [],
    })
    const damagedEntries = await store.readAll()

    await expect(
      hydrateBattleProfileStore({ store, appVersion: "0.1.0" }),
    ).resolves.toMatchObject({
      status: "recovery-required",
      issue: expect.stringContaining(
        "Both Battle Profile checkpoint slots are unreadable",
      ),
    })
    await expect(store.readAll()).resolves.toEqual(damagedEntries)
  })

  it("does not replace an existing quarantine during fallback recovery", async () => {
    const { store } = await createCommittedStore("occupied-quarantine-seed", 32)
    const entries = await store.readAll()
    const snapshotBBytes = entries.get(BATTLE_PROFILE_SNAPSHOT_B_KEY)
    if (!snapshotBBytes) {
      throw new Error("The slot B fixture is missing")
    }
    await store.compareAndSwapVerified({
      expectedEntries: [
        [BATTLE_PROFILE_SNAPSHOT_B_KEY, snapshotBBytes],
        [BATTLE_PROFILE_QUARANTINE_KEY, null],
      ],
      putEntries: [
        [BATTLE_PROFILE_SNAPSHOT_B_KEY, "corrupt-b"],
        [BATTLE_PROFILE_QUARANTINE_KEY, "prior-quarantine"],
      ],
      deleteKeys: [],
    })
    const damagedEntries = await store.readAll()

    await expect(
      hydrateBattleProfileStore({ store, appVersion: "0.1.0" }),
    ).resolves.toMatchObject({
      status: "recovery-required",
      issue: expect.stringContaining(
        "Existing quarantine must be exported or discarded first",
      ),
    })
    await expect(store.readAll()).resolves.toEqual(damagedEntries)
  })

  it("requires explicit recovery when journal retention exceeds its bound", async () => {
    const store = createInMemoryDurableStore()
    await initializeBattleProfileStore({
      store,
      playerData: createTestPlayerData("unbounded-journal-seed"),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const entries = await store.readAll()
    const manifestBytes = entries.get(BATTLE_PROFILE_MANIFEST_KEY)
    if (!manifestBytes) {
      throw new Error("The manifest fixture is missing")
    }
    const manifest = createBattleProfileManifest({
      activeSlot: "a",
      checkpointGeneration: 0,
      checkpointRevision: 0,
      headGeneration: 1,
      headRevision: 1,
    })
    const journalEntries = Array.from(
      { length: 64 },
      (_, index) =>
        [getBattleProfileJournalKey(index + 1), "corrupt-journal"] as const,
    )
    await store.compareAndSwapVerified({
      expectedEntries: [[BATTLE_PROFILE_MANIFEST_KEY, manifestBytes]],
      putEntries: [
        [BATTLE_PROFILE_MANIFEST_KEY, serializeBattleProfileManifest(manifest)],
        ...journalEntries,
      ],
      deleteKeys: [],
    })

    const damagedEntries = await store.readAll()
    await expect(
      hydrateBattleProfileStore({ store, appVersion: "0.1.0" }),
    ).resolves.toMatchObject({
      status: "recovery-required",
      issue: expect.stringContaining(
        "Battle Profile journal retention is unbounded",
      ),
    })
    await expect(store.readAll()).resolves.toEqual(damagedEntries)
  })

  it("requires explicit recovery when journal replay encounters malformed data", async () => {
    const store = createInMemoryDurableStore()
    await initializeBattleProfileStore({
      store,
      playerData: createTestPlayerData("malformed-journal-seed"),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const entries = await store.readAll()
    const manifestBytes = entries.get(BATTLE_PROFILE_MANIFEST_KEY)
    if (!manifestBytes) {
      throw new Error("The manifest fixture is missing")
    }
    const manifest = createBattleProfileManifest({
      activeSlot: "a",
      checkpointGeneration: 0,
      checkpointRevision: 0,
      headGeneration: 1,
      headRevision: 1,
    })
    await store.compareAndSwapVerified({
      expectedEntries: [[BATTLE_PROFILE_MANIFEST_KEY, manifestBytes]],
      putEntries: [
        [BATTLE_PROFILE_MANIFEST_KEY, serializeBattleProfileManifest(manifest)],
        [getBattleProfileJournalKey(1), "malformed-journal"],
      ],
      deleteKeys: [],
    })

    const damagedEntries = await store.readAll()
    await expect(
      hydrateBattleProfileStore({ store, appVersion: "0.1.0" }),
    ).resolves.toMatchObject({
      status: "recovery-required",
      issue: expect.stringContaining("Persisted JSON is malformed"),
    })
    await expect(store.readAll()).resolves.toEqual(damagedEntries)
  })

  it("selects the newest contiguous checkpoint when the manifest is stale", async () => {
    const { store } = await createCommittedStore("stale-manifest-seed", 40)
    const entries = await store.readAll()
    const manifestBytes = entries.get(BATTLE_PROFILE_MANIFEST_KEY)
    if (!manifestBytes) {
      throw new Error("The manifest fixture is missing")
    }
    const staleManifest = createBattleProfileManifest({
      activeSlot: "b",
      checkpointGeneration: 0,
      checkpointRevision: 0,
      headGeneration: 0,
      headRevision: 0,
    })
    await store.compareAndSwapVerified({
      expectedEntries: [[BATTLE_PROFILE_MANIFEST_KEY, manifestBytes]],
      putEntries: [
        [
          BATTLE_PROFILE_MANIFEST_KEY,
          serializeBattleProfileManifest(staleManifest),
        ],
      ],
      deleteKeys: [],
    })

    const result = await hydrateBattleProfileStore({
      store,
      appVersion: "0.1.0",
    })

    expect(result).toMatchObject({
      status: "ready",
      state: {
        head: { generation: 40, revision: 40 },
        manifest: {
          activeSlot: "b",
          checkpointGeneration: 32,
          checkpointRevision: 32,
          headGeneration: 40,
          headRevision: 40,
        },
      },
      recoveryNotice: expect.stringContaining(
        "Active checkpoint does not match the manifest",
      ),
    })
  })

  it("requires explicit recovery when quarantine bytes exceed the persisted limit", async () => {
    const { store } = await createCommittedStore(
      "oversized-quarantine-seed",
      32,
    )
    const entries = await store.readAll()
    const snapshotBBytes = entries.get(BATTLE_PROFILE_SNAPSHOT_B_KEY)
    if (!snapshotBBytes) {
      throw new Error("The slot B fixture is missing")
    }
    const oversizedCheckpoint = "x".repeat(MAX_PERSISTED_JSON_BYTES + 1)
    await store.compareAndSwapVerified({
      expectedEntries: [[BATTLE_PROFILE_SNAPSHOT_B_KEY, snapshotBBytes]],
      putEntries: [[BATTLE_PROFILE_SNAPSHOT_B_KEY, oversizedCheckpoint]],
      deleteKeys: [],
    })
    const damagedEntries = await store.readAll()

    await expect(
      hydrateBattleProfileStore({ store, appVersion: "0.1.0" }),
    ).resolves.toMatchObject({
      status: "recovery-required",
      issue: expect.stringContaining(
        "Unreadable checkpoint exceeds the quarantine byte limit",
      ),
    })
    await expect(store.readAll()).resolves.toEqual(damagedEntries)
  })
})
