import { describe, expect, it } from "vitest"
import { createActor, waitFor } from "xstate"
import { projectBattlePair } from "./BattleScheduler"
import type { DurableStoreAdapter } from "./DurableStoreAdapter"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"
import { rootMachine } from "./RootMachine"

const TEST_TIMESTAMP = "2026-08-19T00:00:00.000Z"
const TEST_UUID = "00000000-0000-4000-8000-000000000000"

const STABLE_CHECKPOINT_SURFACES = Object.freeze([
  "hub",
  "achievements",
  "data-management",
  "all-values",
  "crucible",
] as const)

type StableCheckpointSurface = (typeof STABLE_CHECKPOINT_SURFACES)[number]

function createRootActor(
  durableStore: DurableStoreAdapter = createInMemoryDurableStore(),
) {
  const actor = createActor(rootMachine, {
    input: {
      durableStore,
      appVersion: "0.1.0",
      sourceBuild: "lifecycle-test-build",
      now: () => TEST_TIMESTAMP,
      randomUuid: () => TEST_UUID,
    },
  })

  return { actor, durableStore }
}

type RootActor = ReturnType<typeof createRootActor>["actor"]

async function bootRootActor(
  durableStore: DurableStoreAdapter = createInMemoryDurableStore(),
) {
  const root = createRootActor(durableStore)
  root.actor.start()
  root.actor.send({
    type: "APP.HYDRATED",
    schedulerSeed: "lifecycle-test-seed",
  })
  await waitFor(
    root.actor,
    (snapshot) => snapshot.matches("Hub") || snapshot.matches("Splash"),
  )
  if (root.actor.getSnapshot().matches("Splash")) {
    root.actor.send({ type: "INTRODUCTION.COMPLETED" })
    await waitFor(root.actor, (snapshot) => snapshot.matches("Hub"))
  }

  return root
}

async function commitOneBattle(actor: RootActor) {
  actor.send({ type: "BATTLE.START_REQUESTED" })
  const profile = actor.getSnapshot().context.playerData?.profile
  if (!profile) throw new Error("Battle profile did not initialize")

  const [winnerId] = projectBattlePair(profile.activeDeck, profile.scheduler)
  actor.send({
    type: "BATTLE.WINNER_SELECTED",
    winnerId,
    expectedScheduler: profile.scheduler,
  })
  await waitFor(actor, (snapshot) => snapshot.matches({ Crucible: "Ready" }))
}

function navigateToStableSurface(
  actor: RootActor,
  surface: StableCheckpointSurface,
) {
  if (surface === "crucible") return

  actor.send({ type: "BATTLE.EXIT_REQUESTED" })
  if (surface === "achievements")
    actor.send({ type: "ACHIEVEMENTS.OPEN_REQUESTED" })
  if (surface === "data-management")
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
  if (surface === "all-values")
    actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })
}

function matchesStableSurface(
  actor: RootActor,
  surface: StableCheckpointSurface,
) {
  const snapshot = actor.getSnapshot()
  if (surface === "hub") return snapshot.matches("Hub")
  if (surface === "achievements") return snapshot.matches("Achievements")
  if (surface === "data-management")
    return snapshot.matches({ DataManagement: "Browsing" })
  if (surface === "all-values")
    return snapshot.matches({ AllValues: "Browsing" })

  return snapshot.matches({ Crucible: "Ready" })
}

function createDelayedBattleCommitStore() {
  const memoryStore = createInMemoryDurableStore()
  let releaseBattleCommit: () => void = () => undefined
  const battleCommitBarrier = new Promise<void>((resolve) => {
    releaseBattleCommit = resolve
  })
  let transactionCount = 0

  return {
    durableStore: Object.freeze({
      readAll: memoryStore.readAll,
      compareAndSwapVerified: async (transaction) => {
        transactionCount += 1
        if (transactionCount === 2) await battleCommitBarrier

        await memoryStore.compareAndSwapVerified(transaction)
      },
    }) satisfies DurableStoreAdapter,
    releaseBattleCommit,
  }
}

function createToggleableWriteFailureStore() {
  const memoryStore = createInMemoryDurableStore()
  let writeIssue: string | null = null

  return {
    durableStore: Object.freeze({
      readAll: memoryStore.readAll,
      compareAndSwapVerified: async (transaction) => {
        if (writeIssue) throw new Error(writeIssue)

        await memoryStore.compareAndSwapVerified(transaction)
      },
    }) satisfies DurableStoreAdapter,
    setWriteIssue: (issue: string | null) => {
      writeIssue = issue
    },
  }
}

describe("RootMachine native lifecycle persistence", () => {
  it.each(STABLE_CHECKPOINT_SURFACES)(
    "checkpoints the durable head and restores the %s surface",
    async (surface) => {
      const { actor } = await bootRootActor()
      await commitOneBattle(actor)
      navigateToStableSurface(actor, surface)
      const beforeCheckpoint = actor.getSnapshot().context
      const beforeStoreState = beforeCheckpoint.battleProfileStoreState
      if (!beforeStoreState) throw new Error("Store state did not initialize")

      actor.send({ type: "APP.BACKGROUND_CHECKPOINT_REQUESTED" })
      expect(actor.getSnapshot().matches("BackgroundCheckpointing")).toBe(true)
      await waitFor(actor, () => matchesStableSurface(actor, surface))

      const afterCheckpoint = actor.getSnapshot().context
      const afterStoreState = afterCheckpoint.battleProfileStoreState
      expect(afterCheckpoint.playerData).toBe(beforeCheckpoint.playerData)
      expect(afterStoreState?.head).toBe(beforeStoreState.head)
      expect(afterStoreState?.manifest).toMatchObject({
        checkpointGeneration: beforeStoreState.head.generation,
        checkpointRevision: beforeStoreState.head.revision,
        headGeneration: beforeStoreState.head.generation,
        headRevision: beforeStoreState.head.revision,
      })
      expect(afterCheckpoint.backgroundCheckpointReturnTarget).toBeNull()
      expect(
        afterCheckpoint.playerData?.achievements.progress.lifetimeBattleCount,
      ).toBe(1)
    },
  )

  it("does not interrupt an in-flight battle commit with a checkpoint", async () => {
    const { durableStore, releaseBattleCommit } =
      createDelayedBattleCommitStore()
    const { actor } = await bootRootActor(durableStore)
    actor.send({ type: "BATTLE.START_REQUESTED" })
    const profile = actor.getSnapshot().context.playerData?.profile
    if (!profile) throw new Error("Battle profile did not initialize")

    const [winnerId] = projectBattlePair(profile.activeDeck, profile.scheduler)
    actor.send({
      type: "BATTLE.WINNER_SELECTED",
      winnerId,
      expectedScheduler: profile.scheduler,
    })
    expect(actor.getSnapshot().matches({ Crucible: "Persisting" })).toBe(true)

    actor.send({ type: "APP.BACKGROUND_CHECKPOINT_REQUESTED" })
    expect(actor.getSnapshot().matches({ Crucible: "Persisting" })).toBe(true)

    releaseBattleCommit()
    await waitFor(actor, (snapshot) => snapshot.matches({ Crucible: "Ready" }))
    expect(
      actor.getSnapshot().context.battleProfileStoreState?.manifest,
    ).toMatchObject({
      checkpointGeneration: 0,
      headGeneration: 1,
    })

    actor.send({ type: "APP.BACKGROUND_CHECKPOINT_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches({ Crucible: "Ready" }))
    expect(
      actor.getSnapshot().context.battleProfileStoreState?.manifest,
    ).toMatchObject({
      checkpointGeneration: 1,
      headGeneration: 1,
    })
    expect(
      actor.getSnapshot().context.playerData?.achievements.progress
        .lifetimeBattleCount,
    ).toBe(1)
  })

  it("returns to the originating surface without erasing state when checkpointing fails", async () => {
    const { durableStore, setWriteIssue } = createToggleableWriteFailureStore()
    const { actor } = await bootRootActor(durableStore)
    await commitOneBattle(actor)
    actor.send({ type: "BATTLE.EXIT_REQUESTED" })
    const beforeCheckpoint = actor.getSnapshot().context
    setWriteIssue("background checkpoint unavailable")

    actor.send({ type: "APP.BACKGROUND_CHECKPOINT_REQUESTED" })
    await waitFor(actor, (snapshot) => snapshot.matches("Hub"))

    const afterCheckpoint = actor.getSnapshot().context
    expect(afterCheckpoint.playerData).toBe(beforeCheckpoint.playerData)
    expect(afterCheckpoint.battleProfileStoreState).toBe(
      beforeCheckpoint.battleProfileStoreState,
    )
    expect(afterCheckpoint.backgroundCheckpointReturnTarget).toBeNull()
    expect(afterCheckpoint.persistenceIssue).toBe(
      beforeCheckpoint.persistenceIssue,
    )
  })
})
