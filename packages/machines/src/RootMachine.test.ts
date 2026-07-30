import { createCustomValueId } from "@game/data/src/Value"
import { describe, expect, it } from "vitest"
import { createActor, waitFor } from "xstate"
import {
  BATTLE_PROFILE_MANIFEST_KEY,
  BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
} from "./BattleProfileStore"
import {
  DurableStoreConflictError,
  type DurableStoreAdapter,
} from "./DurableStoreAdapter"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"
import { projectScheduledPair } from "./PairScheduler"
import { createInitialPlayerData } from "./PlayerData"
import { rootMachine } from "./RootMachine"
import {
  createWayvmExport,
  decodeWayvmExport,
  serializeWayvmExport,
} from "./WayvmExport"

const TEST_TIMESTAMP = "2026-07-21T00:00:00.000Z"

function createRootActor({
  durableStore = createInMemoryDurableStore(),
}: {
  readonly durableStore?: DurableStoreAdapter
} = {}) {
  const actor = createActor(rootMachine, {
    input: {
      durableStore,
      appVersion: "0.1.0",
      sourceBuild: "test-build",
      now: () => TEST_TIMESTAMP,
    },
  })

  return { actor, durableStore }
}

async function bootRootActor({
  schedulerSeed = "root-machine-seed",
  durableStore,
  skipIntroduction = false,
}: {
  readonly schedulerSeed?: string
  readonly durableStore?: DurableStoreAdapter
  readonly skipIntroduction?: boolean
} = {}) {
  const root = createRootActor({ durableStore })
  root.actor.start()
  root.actor.send({ type: "APP.HYDRATED", schedulerSeed })
  await waitFor(
    root.actor,
    (snapshot) => snapshot.matches("Hub") || snapshot.matches("Splash"),
  )
  if (!skipIntroduction && root.actor.getSnapshot().matches("Splash")) {
    root.actor.send({ type: "INTRODUCTION.COMPLETED" })
    await waitFor(root.actor, (snapshot) => snapshot.matches("Hub"))
  }

  return root
}

async function bootCorruptRootActor({
  initialEntries,
}: {
  readonly initialEntries: readonly (readonly [string, string])[]
}) {
  const root = createRootActor({
    durableStore: createInMemoryDurableStore(initialEntries),
  })
  root.actor.start()
  root.actor.send({
    type: "APP.HYDRATED",
    schedulerSeed: "unrecoverable-root-seed",
  })
  await waitFor(root.actor, (snapshot) =>
    snapshot.matches({ PersistenceFailure: "Reviewing" }),
  )

  return root
}

async function waitForReadyCrucible(
  actor: ReturnType<typeof createRootActor>["actor"],
) {
  return waitFor(actor, (snapshot) => snapshot.matches({ Crucible: "Ready" }))
}

function expectActorEventError(
  actor: ReturnType<typeof createRootActor>["actor"],
  event: Parameters<ReturnType<typeof createRootActor>["actor"]["send"]>[0],
  message: string,
) {
  let observedError: unknown
  actor.subscribe({
    error: (error: unknown) => {
      observedError = error
    },
  })
  actor.send(event)
  expect(observedError).toMatchObject({
    message: expect.stringContaining(message),
  })
}

describe("Root Machine", () => {
  it("hydrates a fresh canonical profile and initializes after introduction", async () => {
    const { actor, durableStore } = await bootRootActor({
      skipIntroduction: true,
    })

    let snapshot = actor.getSnapshot()
    expect(snapshot.matches("Splash")).toBe(true)
    expect(
      snapshot.context.playerData?.profile?.activeDeck.valueIds,
    ).toHaveLength(100)
    expect(snapshot.context.playerData?.profile?.history).toEqual([])
    expect(snapshot.context.playerData?.profile?.redo).toEqual([])
    await expect(durableStore.readAll()).resolves.toEqual(new Map())

    actor.send({
      type: "INTRODUCTION.COMPLETED",
    })
    snapshot = await waitFor(actor, (candidate) => candidate.matches("Hub"))

    expect(
      snapshot.context.battleProfileStoreState?.head.playerData.profile,
    ).toBe(snapshot.context.playerData?.profile)
    expect((await durableStore.readAll()).size).toBe(2)
  })

  it("initializes an empty durable profile before routing a returning introduction to the Hub", async () => {
    const { actor, durableStore } = await bootRootActor({
      schedulerSeed: "returning-profile-seed",
    })

    expect(actor.getSnapshot().matches("Hub")).toBe(true)
    expect(actor.getSnapshot().context.battleProfileStoreState).not.toBeNull()
    expect((await durableStore.readAll()).size).toBe(2)
  })

  it("opens and closes All Values without replacing the battle profile", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "all-values-profile-seed",
    })

    const battleProfile = actor.getSnapshot().context.playerData?.profile
    actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })

    expect(actor.getSnapshot().matches("AllValues")).toBe(true)
    expect(actor.getSnapshot().context.playerData?.profile).toBe(battleProfile)

    actor.send({ type: "ALL_VALUES.CLOSE_REQUESTED" })

    expect(actor.getSnapshot().matches("Hub")).toBe(true)
    expect(actor.getSnapshot().context.playerData?.profile).toBe(battleProfile)
  })

  it("adds a custom value through the All Values durable update flow", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "all-values-add-seed",
    })

    actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })
    actor.send({
      type: "ALL_VALUES.ADD_REQUESTED",
      name: "Ingenuity",
      definition: "The disciplined practice of creating new solutions.",
    })

    const afterAddSnapshot = await waitFor(actor, (candidate) => {
      if (!candidate.matches({ AllValues: "Browsing" })) {
        return false
      }

      const profile = candidate.context.playerData?.profile
      if (!profile) {
        return false
      }

      const customValue = profile.activeDeck.customValues[0]
      return customValue?.name === "Ingenuity"
    })
    const afterAddProfile = afterAddSnapshot.context.playerData?.profile
    if (!afterAddProfile) {
      throw new Error("Battle profile did not survive custom value add")
    }
    const addedValue = afterAddProfile.activeDeck.customValues[0]
    if (!addedValue) {
      throw new Error("Custom value add did not create a value")
    }

    expect(addedValue.id.startsWith("custom:")).toBe(true)
    expect(addedValue.definition).toBe(
      "The disciplined practice of creating new solutions.",
    )
    expect(afterAddProfile.activeDeck.customValues).toHaveLength(1)
  })

  it("trims custom value input in All Values durable updates", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "all-values-trim-seed",
    })

    actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })
    actor.send({
      type: "ALL_VALUES.ADD_REQUESTED",
      name: "   Ingenuity   ",
      definition: "   The disciplined practice of creating new solutions.   ",
    })

    const afterTrimmedAddSnapshot = await waitFor(actor, (candidate) => {
      if (!candidate.matches({ AllValues: "Browsing" })) {
        return false
      }

      const profile = candidate.context.playerData?.profile
      if (!profile) {
        return false
      }

      return (
        profile.activeDeck.customValues.length === 1 &&
        profile.activeDeck.customValues[0]?.name === "Ingenuity" &&
        profile.activeDeck.customValues[0]?.definition ===
          "The disciplined practice of creating new solutions."
      )
    })

    const addedValue =
      afterTrimmedAddSnapshot.context.playerData?.profile?.activeDeck
        .customValues[0]
    if (!addedValue) {
      throw new Error("Custom value add did not trim inputs")
    }

    expect(addedValue.name).toBe("Ingenuity")
    expect(addedValue.definition).toBe(
      "The disciplined practice of creating new solutions.",
    )
  })

  it("rejects blank Custom Value names and definitions before persistence", async () => {
    const blankNameRoot = await bootRootActor({
      schedulerSeed: "all-values-blank-name-seed",
    })
    blankNameRoot.actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })

    expectActorEventError(
      blankNameRoot.actor,
      {
        type: "ALL_VALUES.ADD_REQUESTED",
        name: "   ",
        definition: "A definition that should never persist.",
      },
      "Custom Value name is required",
    )

    const blankDefinitionRoot = await bootRootActor({
      schedulerSeed: "all-values-blank-definition-seed",
    })
    blankDefinitionRoot.actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })

    expectActorEventError(
      blankDefinitionRoot.actor,
      {
        type: "ALL_VALUES.ADD_REQUESTED",
        name: "A value without a definition",
        definition: "   ",
      },
      "Custom Value definition is required",
    )
  })

  it("rejects blank edits and unknown Custom Value mutations", async () => {
    const blankEditRoot = await bootRootActor({
      schedulerSeed: "all-values-blank-edit-seed",
    })
    blankEditRoot.actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })
    blankEditRoot.actor.send({
      type: "ALL_VALUES.ADD_REQUESTED",
      name: "Ingenuity",
      definition: "The disciplined practice of creating new solutions.",
    })
    const addedSnapshot = await waitFor(blankEditRoot.actor, (candidate) => {
      const profile = candidate.context.playerData?.profile
      return (
        candidate.matches({ AllValues: "Browsing" }) &&
        !!profile &&
        profile.activeDeck.customValues.length === 1
      )
    })
    const customValueId =
      addedSnapshot.context.playerData?.profile?.activeDeck.customValues[0]?.id
    if (!customValueId) {
      throw new Error("Custom value add did not create an id")
    }

    expectActorEventError(
      blankEditRoot.actor,
      {
        type: "ALL_VALUES.UPDATE_REQUESTED",
        valueId: customValueId,
        name: "   ",
        definition: "A valid definition.",
      },
      "Custom Value name is required",
    )

    const blankDefinitionUpdateRoot = await bootRootActor({
      schedulerSeed: "all-values-blank-definition-update-seed",
    })
    blankDefinitionUpdateRoot.actor.send({
      type: "ALL_VALUES.OPEN_REQUESTED",
    })
    blankDefinitionUpdateRoot.actor.send({
      type: "ALL_VALUES.ADD_REQUESTED",
      name: "Ingenuity",
      definition: "The disciplined practice of creating new solutions.",
    })
    const blankDefinitionAddedSnapshot = await waitFor(
      blankDefinitionUpdateRoot.actor,
      (candidate) => {
        const profile = candidate.context.playerData?.profile
        return (
          candidate.matches({ AllValues: "Browsing" }) &&
          !!profile &&
          profile.activeDeck.customValues.length === 1
        )
      },
    )
    const blankDefinitionValueId =
      blankDefinitionAddedSnapshot.context.playerData?.profile?.activeDeck
        .customValues[0]?.id
    if (!blankDefinitionValueId) {
      throw new Error("Custom value add did not create an id")
    }

    expectActorEventError(
      blankDefinitionUpdateRoot.actor,
      {
        type: "ALL_VALUES.UPDATE_REQUESTED",
        valueId: blankDefinitionValueId,
        name: "Ingenuity",
        definition: "   ",
      },
      "Custom Value definition is required",
    )

    const unknownValueId = createCustomValueId(
      "custom:00000000-0000-4000-8000-000000000099",
    )
    const unknownUpdateRoot = await bootRootActor({
      schedulerSeed: "all-values-unknown-update-seed",
    })
    unknownUpdateRoot.actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })

    expectActorEventError(
      unknownUpdateRoot.actor,
      {
        type: "ALL_VALUES.UPDATE_REQUESTED",
        valueId: unknownValueId,
        name: "Missing Value",
        definition: "This value does not exist.",
      },
      "Custom Value does not exist",
    )

    const unknownDeleteRoot = await bootRootActor({
      schedulerSeed: "all-values-unknown-delete-seed",
    })
    unknownDeleteRoot.actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })

    expectActorEventError(
      unknownDeleteRoot.actor,
      {
        type: "ALL_VALUES.DELETE_REQUESTED",
        valueId: unknownValueId,
      },
      "Custom Value does not exist",
    )
  })

  it("edits a custom value through the All Values durable update flow", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "all-values-edit-seed",
    })
    actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })
    actor.send({
      type: "ALL_VALUES.ADD_REQUESTED",
      name: "Ingenuity",
      definition: "The disciplined practice of creating new solutions.",
    })

    const afterAddSnapshot = await waitFor(actor, (candidate) => {
      const profile = candidate.context.playerData?.profile
      return (
        candidate.matches({ AllValues: "Browsing" }) &&
        !!profile &&
        profile.activeDeck.customValues.some(
          (value) => value.name === "Ingenuity",
        )
      )
    })

    const customValueId =
      afterAddSnapshot.context.playerData?.profile?.activeDeck.customValues[0]
        ?.id
    if (!customValueId) {
      throw new Error("Custom value add did not create an id")
    }

    actor.send({
      type: "ALL_VALUES.ADD_REQUESTED",
      name: "Meaning",
      definition: "A sense of purpose in what matters.",
    })
    const afterSecondAddSnapshot = await waitFor(actor, (candidate) => {
      const profile = candidate.context.playerData?.profile
      return (
        candidate.matches({ AllValues: "Browsing" }) &&
        !!profile &&
        profile.activeDeck.customValues.length === 2
      )
    })
    const secondCustomValue =
      afterSecondAddSnapshot.context.playerData?.profile?.activeDeck
        .customValues[1]
    if (!secondCustomValue) {
      throw new Error("Second custom value add did not create a value")
    }

    actor.send({
      type: "ALL_VALUES.UPDATE_REQUESTED",
      valueId: customValueId,
      name: "Curiosity Engine",
      definition: "A drive to explore how things connect.",
    })

    const afterUpdateSnapshot = await waitFor(actor, (candidate) => {
      const profile = candidate.context.playerData?.profile
      if (!candidate.matches({ AllValues: "Browsing" }) || !profile) {
        return false
      }
      return profile.activeDeck.customValues.some(
        (value) =>
          value.id === customValueId && value.name === "Curiosity Engine",
      )
    })

    const afterUpdateProfile = afterUpdateSnapshot.context.playerData?.profile
    if (!afterUpdateProfile) {
      throw new Error("Battle profile did not survive custom value edit")
    }
    const updatedValue = afterUpdateProfile.activeDeck.customValues[0]
    if (!updatedValue) {
      throw new Error("Custom value edit removed the value")
    }

    expect(updatedValue.name).toBe("Curiosity Engine")
    expect(updatedValue.definition).toBe(
      "A drive to explore how things connect.",
    )
    expect(updatedValue.updatedAt).toBe(TEST_TIMESTAMP)
    expect(secondCustomValue.creationOrdinal).toBe(2)
    expect(
      afterUpdateProfile.activeDeck.customValues.find(
        (value) => value.id === secondCustomValue.id,
      ),
    ).toEqual(secondCustomValue)
  })

  it("trims edited custom value input in All Values durable updates", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "all-values-edit-trim-seed",
    })
    actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })
    actor.send({
      type: "ALL_VALUES.ADD_REQUESTED",
      name: "Ingenuity",
      definition: "The disciplined practice of creating new solutions.",
    })

    const afterAddSnapshot = await waitFor(actor, (candidate) => {
      const profile = candidate.context.playerData?.profile
      return (
        candidate.matches({ AllValues: "Browsing" }) &&
        !!profile &&
        profile.activeDeck.customValues.some(
          (value) => value.name === "Ingenuity",
        )
      )
    })

    const customValueId =
      afterAddSnapshot.context.playerData?.profile?.activeDeck.customValues?.[0]
        ?.id
    if (!customValueId) {
      throw new Error("Custom value add did not create an id")
    }

    actor.send({
      type: "ALL_VALUES.UPDATE_REQUESTED",
      valueId: customValueId,
      name: "   Curiosity Engine   ",
      definition: "   A drive to explore how things connect.   ",
    })

    const afterUpdateSnapshot = await waitFor(actor, (candidate) => {
      const profile = candidate.context.playerData?.profile
      if (!candidate.matches({ AllValues: "Browsing" }) || !profile) {
        return false
      }

      return profile.activeDeck.customValues.some(
        (value) =>
          value.id === customValueId &&
          value.name === "Curiosity Engine" &&
          value.definition === "A drive to explore how things connect.",
      )
    })

    const updatedValue =
      afterUpdateSnapshot.context.playerData?.profile?.activeDeck.customValues.find(
        (value) => value.id === customValueId,
      )
    if (!updatedValue) {
      throw new Error("Custom value edit did not return expected value")
    }

    expect(updatedValue.name).toBe("Curiosity Engine")
    expect(updatedValue.definition).toBe(
      "A drive to explore how things connect.",
    )
  })

  it("removes a Custom Value through the atomic durable deck-revision flow", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "all-values-delete-seed",
    })

    actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })
    actor.send({
      type: "ALL_VALUES.ADD_REQUESTED",
      name: "Ingenuity",
      definition: "The disciplined practice of creating new solutions.",
    })

    const afterAddSnapshot = await waitFor(actor, (candidate) => {
      const profile = candidate.context.playerData?.profile
      return (
        candidate.matches({ AllValues: "Browsing" }) &&
        !!profile &&
        profile.activeDeck.customValues.length === 1
      )
    })
    const customValueId =
      afterAddSnapshot.context.playerData?.profile?.activeDeck.customValues[0]
        ?.id
    if (!customValueId) {
      throw new Error("Custom value add did not create an id")
    }

    actor.send({
      type: "ALL_VALUES.DELETE_REQUESTED",
      valueId: customValueId,
    })

    const afterDeleteSnapshot = await waitFor(actor, (candidate) => {
      const profile = candidate.context.playerData?.profile
      return (
        candidate.matches({ AllValues: "Browsing" }) &&
        !!profile &&
        profile.activeDeck.customValues.length === 0
      )
    })
    const afterDeleteProfile = afterDeleteSnapshot.context.playerData?.profile
    if (!afterDeleteProfile) {
      throw new Error("Battle profile did not survive Custom Value delete")
    }

    expect(afterDeleteProfile.activeDeck.values).toHaveLength(100)
    expect(afterDeleteProfile.history).toHaveLength(0)
    expect(afterDeleteProfile.redo).toHaveLength(0)
  })

  it("commits one trusted battle durably and ignores duplicate stale selection events", async () => {
    const { actor, durableStore } = await bootRootActor({
      schedulerSeed: "root-battle-seed",
    })
    actor.send({ type: "BATTLE.START_REQUESTED" })

    const awaitingSnapshot = actor.getSnapshot()
    const awaitingBattleProfile = awaitingSnapshot.context.playerData?.profile
    if (!awaitingBattleProfile) {
      throw new Error("Battle profile did not initialize")
    }

    const [winnerId, loserId] = projectScheduledPair(
      awaitingBattleProfile.activeDeck,
      awaitingBattleProfile.scheduler,
    ).pair
    const selectionEvent = {
      type: "BATTLE.WINNER_SELECTED" as const,
      winnerId,
      expectedScheduler: awaitingBattleProfile.scheduler,
    }
    actor.send(selectionEvent)

    const committedSnapshot = await waitForReadyCrucible(actor)
    const committedBattleProfile = committedSnapshot.context.playerData?.profile
    if (!committedBattleProfile) {
      throw new Error("Battle profile disappeared after selection")
    }

    expect(committedBattleProfile.scheduler.cursor).toBe(1)
    expect(committedBattleProfile.history).toHaveLength(1)
    expect(committedBattleProfile.redo).toEqual([])
    expect(committedBattleProfile.progressById.get(winnerId)).toMatchObject({
      totalXp: 1,
      profileWins: 1,
      profileComparisons: 1,
    })
    expect(committedBattleProfile.progressById.get(loserId)).toMatchObject({
      totalXp: 0,
      profileWins: 0,
      profileComparisons: 1,
    })
    expect((await durableStore.readAll()).size).toBe(3)

    actor.send(selectionEvent)
    expect(actor.getSnapshot().context.playerData?.profile).toBe(
      committedBattleProfile,
    )

    actor.send({ type: "BATTLE.EXIT_REQUESTED" })
    expect(actor.getSnapshot().matches("Hub")).toBe(true)
  })

  it("does not expose the next battle until its durable commit completes", async () => {
    const memoryStore = createInMemoryDurableStore()
    let releaseCommit: () => void = () => undefined
    const commitBarrier = new Promise<void>((resolve) => {
      releaseCommit = resolve
    })
    let transactionCount = 0
    const durableStore = Object.freeze({
      readAll: memoryStore.readAll,
      compareAndSwapVerified: async (transaction) => {
        transactionCount += 1
        if (transactionCount === 2) {
          await commitBarrier
        }
        await memoryStore.compareAndSwapVerified(transaction)
      },
    }) satisfies DurableStoreAdapter
    const { actor } = await bootRootActor({
      schedulerSeed: "durable-barrier-seed",
      durableStore,
    })
    actor.send({ type: "BATTLE.START_REQUESTED" })
    const initialProfile = actor.getSnapshot().context.playerData?.profile
    if (!initialProfile) {
      throw new Error("Battle profile did not initialize")
    }
    const [winnerId] = projectScheduledPair(
      initialProfile.activeDeck,
      initialProfile.scheduler,
    ).pair

    actor.send({
      type: "BATTLE.WINNER_SELECTED",
      winnerId,
      expectedScheduler: initialProfile.scheduler,
    })

    expect(actor.getSnapshot().matches({ Crucible: "Persisting" })).toBe(true)
    expect(actor.getSnapshot().context.playerData?.profile).toBe(initialProfile)

    releaseCommit()
    const committedSnapshot = await waitForReadyCrucible(actor)
    expect(
      committedSnapshot.context.playerData?.profile?.scheduler.cursor,
    ).toBe(1)
  })

  it("applies guarded Undo, Redo, and replacement branches to the durable profile", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-history-seed",
    })
    actor.send({ type: "BATTLE.START_REQUESTED" })

    const initialProfile = actor.getSnapshot().context.playerData?.profile
    if (!initialProfile) {
      throw new Error("Battle profile did not initialize")
    }

    const [firstValueId, secondValueId] = projectScheduledPair(
      initialProfile.activeDeck,
      initialProfile.scheduler,
    ).pair
    actor.send({
      type: "BATTLE.WINNER_SELECTED",
      winnerId: firstValueId,
      expectedScheduler: initialProfile.scheduler,
    })

    const committedProfile = (await waitForReadyCrucible(actor)).context
      .playerData?.profile
    if (!committedProfile) {
      throw new Error("Battle profile disappeared after selection")
    }

    actor.send({ type: "BATTLE.UNDO_REQUESTED" })
    const undoneProfile = (await waitForReadyCrucible(actor)).context.playerData
      ?.profile
    if (!undoneProfile) {
      throw new Error("Battle profile disappeared after Undo")
    }

    expect(undoneProfile.scheduler).toEqual(initialProfile.scheduler)
    expect(undoneProfile.progressById).toEqual(initialProfile.progressById)
    expect(undoneProfile.history).toEqual([])
    expect(undoneProfile.redo).toEqual([committedProfile.history[0]])

    actor.send({ type: "BATTLE.UNDO_REQUESTED" })
    expect(actor.getSnapshot().context.playerData?.profile).toBe(undoneProfile)

    actor.send({ type: "BATTLE.REDO_REQUESTED" })
    const redoneProfile = (await waitForReadyCrucible(actor)).context.playerData
      ?.profile
    if (!redoneProfile) {
      throw new Error("Battle profile disappeared after Redo")
    }

    expect(redoneProfile.scheduler).toEqual(committedProfile.scheduler)
    expect(redoneProfile.progressById).toEqual(committedProfile.progressById)
    expect(redoneProfile.history).toEqual(committedProfile.history)
    expect(redoneProfile.redo).toEqual([])

    actor.send({ type: "BATTLE.UNDO_REQUESTED" })
    const branchProfile = (await waitForReadyCrucible(actor)).context.playerData
      ?.profile
    if (!branchProfile) {
      throw new Error("Battle profile disappeared before branching")
    }
    actor.send({
      type: "BATTLE.WINNER_SELECTED",
      winnerId: secondValueId,
      expectedScheduler: branchProfile.scheduler,
    })

    const replacedProfile = (await waitForReadyCrucible(actor)).context
      .playerData?.profile
    expect(replacedProfile?.history).toHaveLength(1)
    expect(replacedProfile?.history[0]?.winnerId).toBe(secondValueId)
    expect(replacedProfile?.redo).toEqual([])
    expect(
      actor.getSnapshot().context.battleProfileStoreState?.head.revision,
    ).toBe(5)
  })

  it("surfaces durable hydration failure without inventing a replacement profile", async () => {
    const durableStore = Object.freeze({
      readAll: async () => {
        throw new Error("IndexedDB unavailable")
      },
      compareAndSwapVerified: async () => undefined,
    }) satisfies DurableStoreAdapter
    const { actor } = createRootActor({ durableStore })
    actor.start()
    actor.send({
      type: "APP.HYDRATED",
      schedulerSeed: "failed-hydration-seed",
    })

    const snapshot = await waitFor(actor, (candidate) =>
      candidate.matches("PersistenceFailure"),
    )
    expect(snapshot.context.persistenceIssue).toBe("IndexedDB unavailable")
    expect(snapshot.context.battleProfileStoreState).toBeNull()
  })

  it("surfaces durable first-run initialization failure without persisting a profile", async () => {
    const durableStore = Object.freeze({
      readAll: async () => new Map<string, string>(),
      compareAndSwapVerified: async () => {
        throw new Error("Profile initialization failed")
      },
    }) satisfies DurableStoreAdapter
    const { actor } = createRootActor({ durableStore })
    actor.start()
    actor.send({
      type: "APP.HYDRATED",
      schedulerSeed: "failed-initialization-seed",
    })

    await waitFor(actor, (candidate) => candidate.matches("Splash"))
    actor.send({ type: "INTRODUCTION.COMPLETED" })

    const snapshot = await waitFor(actor, (candidate) =>
      candidate.matches("PersistenceFailure"),
    )
    expect(snapshot.context.persistenceIssue).toBe(
      "Profile initialization failed",
    )
    expect(snapshot.context.battleProfileStoreState).toBeNull()
  })

  it("surfaces a durable battle commit failure without mutating the prior profile", async () => {
    const memoryStore = createInMemoryDurableStore()
    let shouldFail = false
    const durableStore = Object.freeze({
      readAll: memoryStore.readAll,
      compareAndSwapVerified: async (transaction) => {
        if (shouldFail) {
          throw new Error("Battle commit failed")
        }

        return memoryStore.compareAndSwapVerified(transaction)
      },
    }) satisfies DurableStoreAdapter
    const { actor } = await bootRootActor({
      durableStore,
      schedulerSeed: "root-battle-failure-seed",
    })

    actor.send({ type: "BATTLE.START_REQUESTED" })
    const priorProfile = actor.getSnapshot().context.playerData?.profile
    if (!priorProfile) {
      throw new Error("Battle profile did not initialize")
    }

    const [winnerId] = projectScheduledPair(
      priorProfile.activeDeck,
      priorProfile.scheduler,
    ).pair
    shouldFail = true
    actor.send({
      type: "BATTLE.WINNER_SELECTED",
      winnerId,
      expectedScheduler: priorProfile.scheduler,
    })

    const snapshot = await waitFor(actor, (candidate) =>
      candidate.matches("PersistenceFailure"),
    )
    expect(snapshot.context.persistenceIssue).toBe("Battle commit failed")
    expect(snapshot.context.playerData?.profile).toBe(priorProfile)
    expect(snapshot.context.pendingBattleProfileCommit).toBeNull()
  })

  it("returns a failed Custom Value write to browsing without replacing the durable profile", async () => {
    const memoryStore = createInMemoryDurableStore()
    let shouldFail = false
    const durableStore = Object.freeze({
      readAll: memoryStore.readAll,
      compareAndSwapVerified: async (transaction) => {
        if (shouldFail) {
          throw new Error("Custom Value commit failed")
        }

        return memoryStore.compareAndSwapVerified(transaction)
      },
    }) satisfies DurableStoreAdapter
    const { actor } = await bootRootActor({
      durableStore,
      schedulerSeed: "root-custom-value-failure-seed",
    })

    actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })
    shouldFail = true
    actor.send({
      type: "ALL_VALUES.ADD_REQUESTED",
      name: "Ingenuity",
      definition: "The disciplined practice of creating new solutions.",
    })

    const snapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ AllValues: "Browsing" }) &&
        candidate.context.persistenceIssue === "Custom Value commit failed",
    )
    expect(snapshot.context.persistenceIssue).toBe("Custom Value commit failed")
    expect(
      snapshot.context.playerData?.profile?.activeDeck.customValues,
    ).toEqual([])
    expect(snapshot.context.pendingBattleProfileCommit).toBeNull()

    shouldFail = false
    actor.send({
      type: "ALL_VALUES.ADD_REQUESTED",
      name: "Ingenuity",
      definition: "The disciplined practice of creating new solutions.",
    })

    const retriedSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ AllValues: "Browsing" }) &&
        candidate.context.playerData?.profile?.activeDeck.customValues
          .length === 1,
    )
    expect(retriedSnapshot.context.persistenceIssue).toBeNull()
  })

  it("retries initialization after a durable conflict and hydrates the persisted profile", async () => {
    const persistedStore = createInMemoryDurableStore()
    await bootRootActor({
      durableStore: persistedStore,
      schedulerSeed: "persisted-profile-seed",
    })
    const persistedEntries = await persistedStore.readAll()
    let readCount = 0
    let compareAndSwapCount = 0
    const durableStore = Object.freeze({
      readAll: async () => {
        readCount += 1
        return readCount === 1 ? new Map() : persistedEntries
      },
      compareAndSwapVerified: async (transaction) => {
        compareAndSwapCount += 1
        if (compareAndSwapCount === 1) {
          throw new DurableStoreConflictError("wayvm.snapshot.manifest")
        }

        return persistedStore.compareAndSwapVerified(transaction)
      },
    }) satisfies DurableStoreAdapter
    const { actor } = await bootRootActor({
      durableStore,
      schedulerSeed: "conflicting-initialization-seed",
    })

    expect(actor.getSnapshot().matches("Hub")).toBe(true)
    expect(readCount).toBe(2)
    expect(compareAndSwapCount).toBe(1)
    expect(
      actor.getSnapshot().context.playerData?.profile?.scheduler.seed,
    ).toBe("persisted-profile-seed")
  })

  it("ignores a winner that is not in the currently projected pair", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-invalid-selection-seed",
    })
    actor.send({ type: "BATTLE.START_REQUESTED" })
    const profile = actor.getSnapshot().context.playerData?.profile
    if (!profile) {
      throw new Error("Battle profile did not initialize")
    }

    const pair = projectScheduledPair(
      profile.activeDeck,
      profile.scheduler,
    ).pair
    const invalidWinnerId = profile.activeDeck.valueIds.find(
      (valueId) => !pair.includes(valueId),
    )
    if (!invalidWinnerId) {
      throw new Error("Expected a value outside the projected pair")
    }

    actor.send({
      type: "BATTLE.WINNER_SELECTED",
      winnerId: invalidWinnerId,
      expectedScheduler: profile.scheduler,
    })

    expect(actor.getSnapshot().matches({ Crucible: "Ready" })).toBe(true)
    expect(actor.getSnapshot().context.playerData?.profile).toBe(profile)
  })

  it("prepares and consumes a canonical export carrying the deployed build identity", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-export-seed",
    })

    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "DATA_MANAGEMENT.EXPORT_REQUESTED" })
    const snapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "Browsing" }) &&
        candidate.context.preparedDownload !== null,
    )
    const preparedDownload = snapshot.context.preparedDownload
    if (!preparedDownload) {
      throw new Error("Export download was not prepared")
    }

    await expect(
      decodeWayvmExport(preparedDownload.serialized),
    ).resolves.toMatchObject({
      exportedAt: TEST_TIMESTAMP,
      sourceAppVersion: "0.1.0",
      sourceBuild: "test-build",
    })
    expect(preparedDownload.filename).toContain("2026-07-21")
    expect(snapshot.context.portabilityNotice).toBe(
      "Your private backup is ready.",
    )

    actor.send({ type: "DATA_MANAGEMENT.EXPORT_CONSUMED" })

    expect(actor.getSnapshot().context.preparedDownload).toBeNull()
  })

  it("rejects invalid import bytes without replacing or abandoning the current Player Data", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-invalid-import-seed",
    })
    const currentPlayerData = actor.getSnapshot().context.playerData

    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({
      type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
      serialized: "{}",
    })
    const snapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "Browsing" }) &&
        candidate.context.portabilityIssue !== null,
    )

    expect(snapshot.context.playerData).toBe(currentPlayerData)
    expect(snapshot.context.pendingImport).toBeNull()
    expect(snapshot.context.portabilityIssue).toBe(
      "Persisted JSON must use tuple arrays rather than objects",
    )
  })

  it("previews and cancels a valid import before replacing complete Player Data with a retained backup", async () => {
    const source = await bootRootActor({
      schedulerSeed: "root-import-source-seed",
    })
    source.actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    source.actor.send({ type: "DATA_MANAGEMENT.EXPORT_REQUESTED" })
    const sourceSnapshot = await waitFor(
      source.actor,
      (candidate) =>
        candidate.matches({ DataManagement: "Browsing" }) &&
        candidate.context.preparedDownload !== null,
    )
    const importBytes = sourceSnapshot.context.preparedDownload?.serialized
    if (!importBytes) {
      throw new Error("Import fixture was not exported")
    }

    const target = await bootRootActor({
      schedulerSeed: "root-import-target-seed",
    })
    const targetPlayerData = target.actor.getSnapshot().context.playerData
    target.actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    target.actor.send({
      type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
      serialized: importBytes,
    })
    let reviewSnapshot = await waitFor(target.actor, (candidate) =>
      candidate.matches({ DataManagement: "ReviewingImport" }),
    )

    expect(reviewSnapshot.context.playerData).toBe(targetPlayerData)
    expect(reviewSnapshot.context.pendingImport?.preview).toMatchObject({
      sourceBuild: "test-build",
      activeValueCount: 100,
      replacesCurrentLocalData: true,
    })

    target.actor.send({ type: "DATA_MANAGEMENT.IMPORT_CANCEL_REQUESTED" })
    expect(
      target.actor.getSnapshot().matches({ DataManagement: "Browsing" }),
    ).toBe(true)
    expect(target.actor.getSnapshot().context.playerData).toBe(targetPlayerData)
    expect(target.actor.getSnapshot().context.pendingImport).toBeNull()

    target.actor.send({
      type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
      serialized: importBytes,
    })
    reviewSnapshot = await waitFor(target.actor, (candidate) =>
      candidate.matches({ DataManagement: "ReviewingImport" }),
    )
    target.actor.send({ type: "DATA_MANAGEMENT.IMPORT_CONFIRM_REQUESTED" })
    const importedSnapshot = await waitFor(
      target.actor,
      (candidate) =>
        candidate.matches({ DataManagement: "Browsing" }) &&
        candidate.context.portabilityNotice ===
          "Your imported values and progress are now active.",
    )

    expect(importedSnapshot.context.playerData?.profile.scheduler.seed).toBe(
      "root-import-source-seed",
    )
    expect(importedSnapshot.context.pendingImport).toBeNull()
    const preImportBackupBytes = (await target.durableStore.readAll()).get(
      BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
    )
    if (!preImportBackupBytes) {
      throw new Error("Pre-import backup was not retained")
    }
    await expect(
      decodeWayvmExport(preImportBackupBytes),
    ).resolves.toMatchObject({
      playerData: {
        profile: {
          scheduler: { seed: "root-import-target-seed" },
        },
      },
    })
    expect(reviewSnapshot.context.playerData).toBe(targetPlayerData)
  })

  it("preserves the reviewed import and current data after a failed replacement so the player can retry", async () => {
    const source = await bootRootActor({
      schedulerSeed: "root-retry-source-seed",
    })
    source.actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    source.actor.send({ type: "DATA_MANAGEMENT.EXPORT_REQUESTED" })
    const sourceSnapshot = await waitFor(
      source.actor,
      (candidate) => candidate.context.preparedDownload !== null,
    )
    const importBytes = sourceSnapshot.context.preparedDownload?.serialized
    if (!importBytes) {
      throw new Error("Retry import fixture was not exported")
    }

    const memoryStore = createInMemoryDurableStore()
    let shouldFail = false
    const durableStore = Object.freeze({
      readAll: memoryStore.readAll,
      compareAndSwapVerified: async (transaction) => {
        if (shouldFail) {
          throw new Error("Import replacement failed")
        }

        return memoryStore.compareAndSwapVerified(transaction)
      },
    }) satisfies DurableStoreAdapter
    const target = await bootRootActor({
      durableStore,
      schedulerSeed: "root-retry-target-seed",
    })
    const targetPlayerData = target.actor.getSnapshot().context.playerData
    target.actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    target.actor.send({
      type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
      serialized: importBytes,
    })
    await waitFor(target.actor, (candidate) =>
      candidate.matches({ DataManagement: "ReviewingImport" }),
    )

    shouldFail = true
    target.actor.send({ type: "DATA_MANAGEMENT.IMPORT_CONFIRM_REQUESTED" })
    const failedSnapshot = await waitFor(
      target.actor,
      (candidate) =>
        candidate.matches({ DataManagement: "ReviewingImport" }) &&
        candidate.context.portabilityIssue === "Import replacement failed",
    )

    expect(failedSnapshot.context.playerData).toBe(targetPlayerData)
    expect(failedSnapshot.context.pendingImport).not.toBeNull()
    expect(failedSnapshot.context.preImportBackupBytes).toBeNull()

    shouldFail = false
    target.actor.send({ type: "DATA_MANAGEMENT.IMPORT_CONFIRM_REQUESTED" })
    const retriedSnapshot = await waitFor(
      target.actor,
      (candidate) =>
        candidate.matches({ DataManagement: "Browsing" }) &&
        candidate.context.portabilityNotice ===
          "Your imported values and progress are now active.",
    )

    expect(retriedSnapshot.context.portabilityIssue).toBeNull()
    expect(retriedSnapshot.context.playerData?.profile.scheduler.seed).toBe(
      "root-retry-source-seed",
    )
  })

  it("deletes all Custom Values through one reviewed reset while preserving canonical progress", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-delete-custom-values",
    })
    actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })
    actor.send({
      type: "ALL_VALUES.ADD_REQUESTED",
      name: "Ingenuity",
      definition: "The practice of making original solutions.",
    })
    const withCustomValue = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ AllValues: "Browsing" }) &&
        candidate.context.playerData?.profile.activeDeck.customValues.length ===
          1,
    )
    actor.send({ type: "ALL_VALUES.CLOSE_REQUESTED" })
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({
      type: "DATA_MANAGEMENT.RESET_OPEN_REQUESTED",
      resetKind: "delete-all-custom-values",
    })

    expect(
      actor.getSnapshot().matches({ DataManagement: "ReviewingReset" }),
    ).toBe(true)
    actor.send({
      type: "DATA_MANAGEMENT.RESET_CONFIRM_REQUESTED",
      deleteAllDataAcknowledged: false,
    })
    const resetSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "Browsing" }) &&
        candidate.context.portabilityNotice?.startsWith(
          "All Custom Values were deleted.",
        ) === true,
    )

    expect(
      resetSnapshot.context.playerData?.profile.activeDeck.customValues,
    ).toEqual([])
    expect(
      resetSnapshot.context.playerData?.profile.scheduler.deckRevision,
    ).toBe(
      (withCustomValue.context.playerData?.profile.scheduler.deckRevision ??
        0) + 1,
    )
  })

  it("resets levels and experience through a new progress generation while retaining achievements and deck membership", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-reset-progress",
    })
    actor.send({ type: "BATTLE.START_REQUESTED" })
    const playedProfile = actor.getSnapshot().context.playerData?.profile
    if (!playedProfile) {
      throw new Error("Progress reset fixture did not initialize")
    }
    const [winnerId] = projectScheduledPair(
      playedProfile.activeDeck,
      playedProfile.scheduler,
    ).pair
    actor.send({
      type: "BATTLE.WINNER_SELECTED",
      winnerId,
      expectedScheduler: playedProfile.scheduler,
    })
    await waitFor(actor, (candidate) =>
      candidate.matches({ Crucible: "Ready" }),
    )
    actor.send({ type: "BATTLE.EXIT_REQUESTED" })
    const beforeReset = actor.getSnapshot().context.playerData
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({
      type: "DATA_MANAGEMENT.RESET_OPEN_REQUESTED",
      resetKind: "reset-levels-and-experience",
    })
    actor.send({
      type: "DATA_MANAGEMENT.RESET_CONFIRM_REQUESTED",
      deleteAllDataAcknowledged: false,
    })
    const resetSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "Browsing" }) &&
        candidate.context.portabilityNotice?.startsWith(
          "Levels and experience were reset.",
        ) === true,
    )
    const resetPlayerData = resetSnapshot.context.playerData
    if (!beforeReset || !resetPlayerData) {
      throw new Error("Progress reset Player Data is unavailable")
    }

    expect(resetPlayerData.profile.activeDeck.valueIds).toEqual(
      beforeReset.profile.activeDeck.valueIds,
    )
    expect(resetPlayerData.profile.scheduler.progressGeneration).toBe(
      beforeReset.profile.scheduler.progressGeneration + 1,
    )
    expect(resetPlayerData.profile.history).toEqual([])
    expect(
      Array.from(resetPlayerData.profile.progressById.values()).every(
        ({ totalXp }) => totalXp === 0,
      ),
    ).toBe(true)
    expect(resetPlayerData.achievements.unlocks).toEqual(
      beforeReset.achievements.unlocks,
    )
  })

  it("resets only achievements while preserving the complete profile timeline", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-reset-achievements",
    })
    actor.send({ type: "BATTLE.START_REQUESTED" })
    const profile = actor.getSnapshot().context.playerData?.profile
    if (!profile) {
      throw new Error("Achievement reset fixture did not initialize")
    }
    const [winnerId] = projectScheduledPair(
      profile.activeDeck,
      profile.scheduler,
    ).pair
    actor.send({
      type: "BATTLE.WINNER_SELECTED",
      winnerId,
      expectedScheduler: profile.scheduler,
    })
    await waitFor(actor, (candidate) =>
      candidate.matches({ Crucible: "Ready" }),
    )
    actor.send({ type: "BATTLE.EXIT_REQUESTED" })
    const beforeReset = actor.getSnapshot().context.playerData
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({
      type: "DATA_MANAGEMENT.RESET_OPEN_REQUESTED",
      resetKind: "reset-achievements",
    })
    actor.send({
      type: "DATA_MANAGEMENT.RESET_CONFIRM_REQUESTED",
      deleteAllDataAcknowledged: false,
    })
    const resetSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "Browsing" }) &&
        candidate.context.portabilityNotice?.startsWith(
          "Achievements and achievement progress were reset.",
        ) === true,
    )
    const resetPlayerData = resetSnapshot.context.playerData
    if (!beforeReset || !resetPlayerData) {
      throw new Error("Achievement reset Player Data is unavailable")
    }

    expect(resetPlayerData.profile).toEqual(beforeReset.profile)
    expect(resetPlayerData.achievements.unlocks).toEqual([])
    expect(resetPlayerData.achievements.progress).toMatchObject({
      achievementProgressGeneration:
        beforeReset.achievements.progress.achievementProgressGeneration + 1,
      lifetimeBattleCount: 0,
      completedCycleCount: 0,
      countedBattleWindow: beforeReset.profile.history.map(
        ({ battleId }) => battleId,
      ),
    })
  })

  it("keeps reset review active through export and refuses complete erasure until acknowledged", async () => {
    const { actor, durableStore } = await bootRootActor({
      schedulerSeed: "root-delete-all-data",
    })
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({
      type: "DATA_MANAGEMENT.RESET_OPEN_REQUESTED",
      resetKind: "delete-all-data",
    })
    actor.send({ type: "DATA_MANAGEMENT.EXPORT_REQUESTED" })
    const exportedReview = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "ReviewingReset" }) &&
        candidate.context.preparedDownload !== null,
    )

    expect(exportedReview.context.pendingResetKind).toBe("delete-all-data")
    actor.send({ type: "DATA_MANAGEMENT.EXPORT_CONSUMED" })
    actor.send({
      type: "DATA_MANAGEMENT.RESET_CONFIRM_REQUESTED",
      deleteAllDataAcknowledged: false,
    })

    expect(
      actor.getSnapshot().matches({ DataManagement: "ReviewingReset" }),
    ).toBe(true)
    expect((await durableStore.readAll()).size).toBeGreaterThan(0)

    actor.send({
      type: "DATA_MANAGEMENT.RESET_CONFIRM_REQUESTED",
      deleteAllDataAcknowledged: true,
    })
    const deletedSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches("Splash") &&
        candidate.context.portabilityNotice ===
          "All local WAYVM player data was deleted.",
    )

    await expect(durableStore.readAll()).resolves.toEqual(new Map())
    expect(deletedSnapshot.context.battleProfileStoreState).toBeNull()

    actor.send({ type: "INTRODUCTION.COMPLETED" })
    await waitFor(actor, (candidate) => candidate.matches("Hub"))
    expect((await durableStore.readAll()).size).toBe(2)
  })

  it("returns a failed scoped reset to review with its intent intact for retry", async () => {
    const memoryStore = createInMemoryDurableStore()
    let shouldFail = false
    const durableStore = Object.freeze({
      readAll: memoryStore.readAll,
      compareAndSwapVerified: async (transaction) => {
        if (shouldFail) {
          throw new Error("Scoped reset failed")
        }

        return memoryStore.compareAndSwapVerified(transaction)
      },
    }) satisfies DurableStoreAdapter
    const { actor } = await bootRootActor({
      durableStore,
      schedulerSeed: "root-reset-retry",
    })
    const currentPlayerData = actor.getSnapshot().context.playerData
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({
      type: "DATA_MANAGEMENT.RESET_OPEN_REQUESTED",
      resetKind: "reset-achievements",
    })
    shouldFail = true
    actor.send({
      type: "DATA_MANAGEMENT.RESET_CONFIRM_REQUESTED",
      deleteAllDataAcknowledged: false,
    })
    const failedSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "ReviewingReset" }) &&
        candidate.context.portabilityIssue === "Scoped reset failed",
    )

    expect(failedSnapshot.context.playerData).toBe(currentPlayerData)
    expect(failedSnapshot.context.pendingResetKind).toBe("reset-achievements")

    shouldFail = false
    actor.send({
      type: "DATA_MANAGEMENT.RESET_CONFIRM_REQUESTED",
      deleteAllDataAcknowledged: false,
    })
    const retriedSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "Browsing" }) &&
        candidate.context.pendingResetKind === null,
    )

    expect(retriedSnapshot.context.portabilityIssue).toBeNull()
  })

  it("exports the exact captured corrupt records as diagnostic evidence before recovery", async () => {
    const corruptEntries = [
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
    ] as const
    const { actor } = await bootCorruptRootActor({
      initialEntries: corruptEntries,
    })

    actor.send({ type: "RECOVERY.EXPORT_REQUESTED" })
    const exportedSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ PersistenceFailure: "Reviewing" }) &&
        candidate.context.preparedDownload !== null,
    )
    const preparedDownload = exportedSnapshot.context.preparedDownload
    if (!preparedDownload) {
      throw new Error("Recovery evidence was not prepared")
    }

    expect(preparedDownload.filename).toContain("mapache-recovery")
    expect(JSON.parse(preparedDownload.serialized)).toEqual(
      expect.arrayContaining([
        "wayvm-recovery-bundle",
        expect.arrayContaining([
          [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
          [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
        ]),
      ]),
    )

    actor.send({ type: "RECOVERY.EXPORT_CONSUMED" })
    expect(actor.getSnapshot().context.preparedDownload).toBeNull()
  })

  it("restores a retained pre-import backup only after validated preview and explicit confirmation", async () => {
    const restoredPlayerData = createInitialPlayerData({
      schedulerSeed: "retained-recovery-backup",
      createdAt: TEST_TIMESTAMP,
    })
    const serializedBackup = serializeWayvmExport(
      await createWayvmExport({
        exportedAt: TEST_TIMESTAMP,
        sourceAppVersion: "0.1.0",
        sourceBuild: "retained-backup-build",
        playerData: restoredPlayerData,
      }),
    )
    const { actor, durableStore } = await bootCorruptRootActor({
      initialEntries: [
        [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
        [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
        [BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY, serializedBackup],
      ],
    })

    actor.send({ type: "RECOVERY.RESTORE_BACKUP_REQUESTED" })
    const reviewSnapshot = await waitFor(actor, (candidate) =>
      candidate.matches({ PersistenceFailure: "ReviewingImport" }),
    )

    expect(reviewSnapshot.context.pendingImport?.preview).toMatchObject({
      sourceBuild: "retained-backup-build",
      activeValueCount: 100,
      replacesCurrentLocalData: true,
    })

    actor.send({ type: "RECOVERY.IMPORT_CONFIRM_REQUESTED" })
    const restoredSnapshot = await waitFor(actor, (candidate) =>
      candidate.matches("Hub"),
    )

    expect(restoredSnapshot.context.playerData?.profile.scheduler.seed).toBe(
      "retained-recovery-backup",
    )
    expect(restoredSnapshot.context.recoveryEntries).toBeNull()
    expect(restoredSnapshot.context.portabilityNotice).toBe(
      "Your backup replaced the unreadable local data.",
    )
    expect(
      (await durableStore.readAll()).has(BATTLE_PROFILE_MANIFEST_KEY),
    ).toBe(true)
    expect(
      (await durableStore.readAll()).has(BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY),
    ).toBe(false)
  })

  it("rejects invalid selected recovery bytes without mutating the captured corrupt store", async () => {
    const initialEntries = [
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
    ] as const
    const { actor, durableStore } = await bootCorruptRootActor({
      initialEntries,
    })
    const capturedEntries = await durableStore.readAll()

    actor.send({
      type: "RECOVERY.IMPORT_PREPARE_REQUESTED",
      serialized: "{}",
    })
    const rejectedSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ PersistenceFailure: "Reviewing" }) &&
        candidate.context.portabilityIssue !== null,
    )

    expect(rejectedSnapshot.context.pendingImport).toBeNull()
    expect(rejectedSnapshot.context.portabilityIssue).toBe(
      "Persisted JSON must use tuple arrays rather than objects",
    )
    await expect(durableStore.readAll()).resolves.toEqual(capturedEntries)
  })

  it("requires fresh acknowledgment before deleting every captured corrupt record", async () => {
    const { actor, durableStore } = await bootCorruptRootActor({
      initialEntries: [
        [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
        [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      ],
    })

    actor.send({
      type: "RECOVERY.DELETE_ALL_REQUESTED",
      acknowledged: false,
    })
    expect(
      actor.getSnapshot().matches({ PersistenceFailure: "Reviewing" }),
    ).toBe(true)
    expect((await durableStore.readAll()).size).toBe(2)

    actor.send({
      type: "RECOVERY.DELETE_ALL_REQUESTED",
      acknowledged: true,
    })
    const deletedSnapshot = await waitFor(actor, (candidate) =>
      candidate.matches("Splash"),
    )

    await expect(durableStore.readAll()).resolves.toEqual(new Map())
    expect(deletedSnapshot.context.recoveryEntries).toBeNull()
    expect(deletedSnapshot.context.portabilityNotice).toBe(
      "All local WAYVM player data was deleted.",
    )
  })

  it("keeps destructive recovery events inert when a runtime failure has no captured hydration evidence", async () => {
    let compareAndSwapCallCount = 0
    const durableStore = Object.freeze({
      readAll: async () => {
        throw new Error("IndexedDB unavailable")
      },
      compareAndSwapVerified: async () => {
        compareAndSwapCallCount += 1
      },
    }) satisfies DurableStoreAdapter
    const { actor } = createRootActor({ durableStore })
    actor.start()
    actor.send({
      type: "APP.HYDRATED",
      schedulerSeed: "runtime-failure-recovery-guard",
    })
    await waitFor(actor, (candidate) =>
      candidate.matches({ PersistenceFailure: "Reviewing" }),
    )

    actor.send({ type: "RECOVERY.EXPORT_REQUESTED" })
    actor.send({
      type: "RECOVERY.IMPORT_PREPARE_REQUESTED",
      serialized: "{}",
    })
    actor.send({
      type: "RECOVERY.DELETE_ALL_REQUESTED",
      acknowledged: true,
    })

    expect(
      actor.getSnapshot().matches({ PersistenceFailure: "Reviewing" }),
    ).toBe(true)
    expect(actor.getSnapshot().context.recoveryEntries).toBeNull()
    expect(actor.getSnapshot().context.preparedDownload).toBeNull()
    expect(actor.getSnapshot().context.pendingImport).toBeNull()
    expect(compareAndSwapCallCount).toBe(0)
  })
})
