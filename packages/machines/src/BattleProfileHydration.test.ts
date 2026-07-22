import { describe, expect, it } from "vitest"
import { applyBattleChoice, createInitialBattleProfile } from "./BattleProfile"
import { createBattleChoiceEvent } from "./BattleProfileEvent"
import { hydrateBattleProfileStore } from "./BattleProfileHydration"
import {
  BATTLE_PROFILE_JOURNAL_KEY_PREFIX,
  BATTLE_PROFILE_MANIFEST_KEY,
  commitBattleProfileStoreEvent,
  initializeBattleProfileStore,
} from "./BattleProfileStore"
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

describe("Battle Profile Hydration", () => {
  it("reports an untouched store as empty", async () => {
    await expect(
      hydrateBattleProfileStore({
        store: createInMemoryDurableStore(),
        appVersion: "0.1.0",
      }),
    ).resolves.toEqual({ status: "empty" })
  })

  it("reconstructs the manifest head from its active checkpoint and journals", async () => {
    const store = createInMemoryDurableStore()
    let state = await initializeBattleProfileStore({
      store,
      profile: createInitialBattleProfile("hydration-seed"),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })

    for (let generation = 1; generation <= 40; generation += 1) {
      state = await commitBattleProfileStoreEvent({
        store,
        state,
        event: createChoiceEvent(state.head.profile),
        committedAt: new Date(
          Date.UTC(2026, 6, 21, 0, generation),
        ).toISOString(),
      })
    }

    await expect(
      hydrateBattleProfileStore({ store, appVersion: "0.2.0" }),
    ).resolves.toEqual({
      status: "ready",
      state: { ...state, appVersion: "0.2.0" },
    })
  })

  it("preserves all bytes and requests recovery when a journal is missing", async () => {
    const store = createInMemoryDurableStore()
    let state = await initializeBattleProfileStore({
      store,
      profile: createInitialBattleProfile("missing-journal-seed"),
      createdAt: "2026-07-21T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    state = await commitBattleProfileStoreEvent({
      store,
      state,
      event: createChoiceEvent(state.head.profile),
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
    const damagedEntries = await store.readAll()
    const result = await hydrateBattleProfileStore({
      store,
      appVersion: "0.1.0",
    })

    expect(result).toMatchObject({
      status: "recovery-required",
      issue: "Battle Profile journal generation 1 is missing",
    })
    await expect(store.readAll()).resolves.toEqual(damagedEntries)
  })

  it("preserves corrupt manifest bytes for recovery", async () => {
    const store = createInMemoryDurableStore()
    await initializeBattleProfileStore({
      store,
      profile: createInitialBattleProfile("corrupt-manifest-seed"),
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
      status: "recovery-required",
      issue: "Persisted JSON is malformed",
    })
    await expect(store.readAll()).resolves.toEqual(
      new Map(entries).set(BATTLE_PROFILE_MANIFEST_KEY, "corrupt"),
    )
  })
})
