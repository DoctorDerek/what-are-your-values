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
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
  BATTLE_PROFILE_SNAPSHOT_B_KEY,
  commitBattleProfileStoreEvent,
  getBattleProfileJournalKey,
  initializeBattleProfileStore,
  readBattleProfileJournalKeyGeneration,
} from "./BattleProfileStore"
import { DurableStoreConflictError } from "./DurableStoreAdapter"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"
import { projectScheduledPair } from "./PairScheduler"

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

  it("appends one verified event and rejects a stale competing writer", async () => {
    const store = createInMemoryDurableStore()
    const initialState = await initializeBattleProfileStore({
      store,
      profile: createInitialBattleProfile("store-commit-seed"),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const event = createChoiceEvent(initialState.head.profile)
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
      profile: createInitialBattleProfile("store-rotation-seed"),
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
        event: createChoiceEvent(state.head.profile),
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
      profile: state.head.profile,
    })
    expect(entries.has(BATTLE_PROFILE_SNAPSHOT_B_KEY)).toBe(true)
    expect(entries.has(`${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}32`)).toBe(false)
    expect(entries.has(`${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}33`)).toBe(true)
    expect(entries.has(`${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}64`)).toBe(true)
    expect(state.journalKeys).toHaveLength(32)
  })
})
