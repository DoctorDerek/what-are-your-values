import { createCustomValueId } from "@game/data/src/Value"
import { describe, expect, it } from "vitest"
import { createActor, waitFor } from "xstate"
import {
  DurableStoreConflictError,
  type DurableStoreAdapter,
} from "./DurableStoreAdapter"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"
import { projectScheduledPair } from "./PairScheduler"
import { rootMachine } from "./RootMachine"

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
    expect(snapshot.context.battleProfile?.activeDeck.valueIds).toHaveLength(
      100,
    )
    expect(snapshot.context.battleProfile?.history).toEqual([])
    expect(snapshot.context.battleProfile?.redo).toEqual([])
    await expect(durableStore.readAll()).resolves.toEqual(new Map())

    actor.send({
      type: "INTRODUCTION.COMPLETED",
    })
    snapshot = await waitFor(actor, (candidate) => candidate.matches("Hub"))

    expect(snapshot.context.battleProfileStoreState?.head.profile).toBe(
      snapshot.context.battleProfile,
    )
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

    const battleProfile = actor.getSnapshot().context.battleProfile
    actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })

    expect(actor.getSnapshot().matches("AllValues")).toBe(true)
    expect(actor.getSnapshot().context.battleProfile).toBe(battleProfile)

    actor.send({ type: "ALL_VALUES.CLOSE_REQUESTED" })

    expect(actor.getSnapshot().matches("Hub")).toBe(true)
    expect(actor.getSnapshot().context.battleProfile).toBe(battleProfile)
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

      const profile = candidate.context.battleProfile
      if (!profile) {
        return false
      }

      const customValue = profile.activeDeck.customValues[0]
      return customValue?.name === "Ingenuity"
    })
    const afterAddProfile = afterAddSnapshot.context.battleProfile
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

      const profile = candidate.context.battleProfile
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
      afterTrimmedAddSnapshot.context.battleProfile?.activeDeck.customValues[0]
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
      const profile = candidate.context.battleProfile
      return (
        candidate.matches({ AllValues: "Browsing" }) &&
        !!profile &&
        profile.activeDeck.customValues.length === 1
      )
    })
    const customValueId =
      addedSnapshot.context.battleProfile?.activeDeck.customValues[0]?.id
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
        const profile = candidate.context.battleProfile
        return (
          candidate.matches({ AllValues: "Browsing" }) &&
          !!profile &&
          profile.activeDeck.customValues.length === 1
        )
      },
    )
    const blankDefinitionValueId =
      blankDefinitionAddedSnapshot.context.battleProfile?.activeDeck
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
      const profile = candidate.context.battleProfile
      return (
        candidate.matches({ AllValues: "Browsing" }) &&
        !!profile &&
        profile.activeDeck.customValues.some(
          (value) => value.name === "Ingenuity",
        )
      )
    })

    const customValueId =
      afterAddSnapshot.context.battleProfile?.activeDeck.customValues[0]?.id
    if (!customValueId) {
      throw new Error("Custom value add did not create an id")
    }

    actor.send({
      type: "ALL_VALUES.ADD_REQUESTED",
      name: "Meaning",
      definition: "A sense of purpose in what matters.",
    })
    const afterSecondAddSnapshot = await waitFor(actor, (candidate) => {
      const profile = candidate.context.battleProfile
      return (
        candidate.matches({ AllValues: "Browsing" }) &&
        !!profile &&
        profile.activeDeck.customValues.length === 2
      )
    })
    const secondCustomValue =
      afterSecondAddSnapshot.context.battleProfile?.activeDeck.customValues[1]
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
      const profile = candidate.context.battleProfile
      if (!candidate.matches({ AllValues: "Browsing" }) || !profile) {
        return false
      }
      return profile.activeDeck.customValues.some(
        (value) =>
          value.id === customValueId && value.name === "Curiosity Engine",
      )
    })

    const afterUpdateProfile = afterUpdateSnapshot.context.battleProfile
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
      const profile = candidate.context.battleProfile
      return (
        candidate.matches({ AllValues: "Browsing" }) &&
        !!profile &&
        profile.activeDeck.customValues.some(
          (value) => value.name === "Ingenuity",
        )
      )
    })

    const customValueId =
      afterAddSnapshot.context.battleProfile?.activeDeck.customValues?.[0]?.id
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
      const profile = candidate.context.battleProfile
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
      afterUpdateSnapshot.context.battleProfile?.activeDeck.customValues.find(
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
      const profile = candidate.context.battleProfile
      return (
        candidate.matches({ AllValues: "Browsing" }) &&
        !!profile &&
        profile.activeDeck.customValues.length === 1
      )
    })
    const customValueId =
      afterAddSnapshot.context.battleProfile?.activeDeck.customValues[0]?.id
    if (!customValueId) {
      throw new Error("Custom value add did not create an id")
    }

    actor.send({
      type: "ALL_VALUES.DELETE_REQUESTED",
      valueId: customValueId,
    })

    const afterDeleteSnapshot = await waitFor(actor, (candidate) => {
      const profile = candidate.context.battleProfile
      return (
        candidate.matches({ AllValues: "Browsing" }) &&
        !!profile &&
        profile.activeDeck.customValues.length === 0
      )
    })
    const afterDeleteProfile = afterDeleteSnapshot.context.battleProfile
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
    const awaitingBattleProfile = awaitingSnapshot.context.battleProfile
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
    const committedBattleProfile = committedSnapshot.context.battleProfile
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
    expect(actor.getSnapshot().context.battleProfile).toBe(
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
    const initialProfile = actor.getSnapshot().context.battleProfile
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
    expect(actor.getSnapshot().context.battleProfile).toBe(initialProfile)

    releaseCommit()
    const committedSnapshot = await waitForReadyCrucible(actor)
    expect(committedSnapshot.context.battleProfile?.scheduler.cursor).toBe(1)
  })

  it("applies guarded Undo, Redo, and replacement branches to the durable profile", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-history-seed",
    })
    actor.send({ type: "BATTLE.START_REQUESTED" })

    const initialProfile = actor.getSnapshot().context.battleProfile
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
      .battleProfile
    if (!committedProfile) {
      throw new Error("Battle profile disappeared after selection")
    }

    actor.send({ type: "BATTLE.UNDO_REQUESTED" })
    const undoneProfile = (await waitForReadyCrucible(actor)).context
      .battleProfile
    if (!undoneProfile) {
      throw new Error("Battle profile disappeared after Undo")
    }

    expect(undoneProfile.scheduler).toEqual(initialProfile.scheduler)
    expect(undoneProfile.progressById).toEqual(initialProfile.progressById)
    expect(undoneProfile.history).toEqual([])
    expect(undoneProfile.redo).toEqual([committedProfile.history[0]])

    actor.send({ type: "BATTLE.UNDO_REQUESTED" })
    expect(actor.getSnapshot().context.battleProfile).toBe(undoneProfile)

    actor.send({ type: "BATTLE.REDO_REQUESTED" })
    const redoneProfile = (await waitForReadyCrucible(actor)).context
      .battleProfile
    if (!redoneProfile) {
      throw new Error("Battle profile disappeared after Redo")
    }

    expect(redoneProfile.scheduler).toEqual(committedProfile.scheduler)
    expect(redoneProfile.progressById).toEqual(committedProfile.progressById)
    expect(redoneProfile.history).toEqual(committedProfile.history)
    expect(redoneProfile.redo).toEqual([])

    actor.send({ type: "BATTLE.UNDO_REQUESTED" })
    const branchProfile = (await waitForReadyCrucible(actor)).context
      .battleProfile
    if (!branchProfile) {
      throw new Error("Battle profile disappeared before branching")
    }
    actor.send({
      type: "BATTLE.WINNER_SELECTED",
      winnerId: secondValueId,
      expectedScheduler: branchProfile.scheduler,
    })

    const replacedProfile = (await waitForReadyCrucible(actor)).context
      .battleProfile
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
    const priorProfile = actor.getSnapshot().context.battleProfile
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
    expect(snapshot.context.battleProfile).toBe(priorProfile)
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
    expect(snapshot.context.battleProfile?.activeDeck.customValues).toEqual([])
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
        candidate.context.battleProfile?.activeDeck.customValues.length === 1,
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
    expect(actor.getSnapshot().context.battleProfile?.scheduler.seed).toBe(
      "persisted-profile-seed",
    )
  })

  it("ignores a winner that is not in the currently projected pair", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-invalid-selection-seed",
    })
    actor.send({ type: "BATTLE.START_REQUESTED" })
    const profile = actor.getSnapshot().context.battleProfile
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
    expect(actor.getSnapshot().context.battleProfile).toBe(profile)
  })
})
