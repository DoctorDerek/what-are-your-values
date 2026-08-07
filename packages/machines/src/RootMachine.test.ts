import { createCustomValueId } from "@game/data/src/Value"
import { describe, expect, it, vi } from "vitest"
import { createActor, fromPromise, waitFor } from "xstate"
import {
  createRecoveryBundleActor,
  deleteUnrecoverablePlayerDataActor,
  replaceUnrecoverablePlayerDataActor,
} from "./BattleProfileRecoveryActors"
import {
  BATTLE_PROFILE_MANIFEST_KEY,
  BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
} from "./BattleProfileStore"
import { projectBattlePair } from "./BattleScheduler"
import {
  DurableStoreConflictError,
  type DurableStoreAdapter,
} from "./DurableStoreAdapter"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"
import { projectScheduledPair } from "./PairScheduler"
import { createInitialPlayerData } from "./PlayerData"
import {
  createWayvmExportActor,
  prepareWayvmImportActor,
} from "./PlayerDataPortabilityActors"
import { playerDataPortabilityCopy } from "./PlayerDataPortabilityCopy"
import { DELETE_ALL_DATA_ACKNOWLEDGMENT } from "./PlayerDataReset"
import {
  applyScopedPlayerDataResetActor,
  deleteAllPlayerDataActor,
} from "./PlayerDataResetActors"
import { rootMachine } from "./RootMachine"
import {
  createWayvmExport,
  decodeWayvmExport,
  serializeWayvmExport,
} from "./WayvmExport"

const TEST_TIMESTAMP = "2026-07-21T00:00:00.000Z"

function createRootActor({
  durableStore = createInMemoryDurableStore(),
  randomUuid = () => crypto.randomUUID(),
  rootLogic = rootMachine,
}: {
  readonly durableStore?: DurableStoreAdapter
  readonly randomUuid?: () => string
  readonly rootLogic?: typeof rootMachine
} = {}) {
  const actor = createActor(rootLogic, {
    input: {
      durableStore,
      appVersion: "0.1.0",
      sourceBuild: "test-build",
      now: () => TEST_TIMESTAMP,
      randomUuid,
    },
  })

  return { actor, durableStore }
}

async function createSerializedImportFixture(schedulerSeed: string) {
  return serializeWayvmExport(
    await createWayvmExport({
      exportedAt: TEST_TIMESTAMP,
      sourceAppVersion: "0.1.0",
      sourceBuild: "import-fixture-build",
      playerData: createInitialPlayerData({
        schedulerSeed,
        createdAt: TEST_TIMESTAMP,
      }),
    }),
  )
}

async function bootRootActor({
  schedulerSeed = "root-machine-seed",
  durableStore,
  randomUuid,
  rootLogic,
  skipIntroduction = false,
}: {
  readonly schedulerSeed?: string
  readonly durableStore?: DurableStoreAdapter
  readonly randomUuid?: () => string
  readonly rootLogic?: typeof rootMachine
  readonly skipIntroduction?: boolean
} = {}) {
  const root = createRootActor({ durableStore, randomUuid, rootLogic })
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
  rootLogic,
}: {
  readonly initialEntries: readonly (readonly [string, string])[]
  readonly rootLogic?: typeof rootMachine
}) {
  const root = createRootActor({
    durableStore: createInMemoryDurableStore(initialEntries),
    rootLogic,
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

async function createSerializedRecoveryBackup({
  schedulerSeed,
  sourceBuild,
}: {
  readonly schedulerSeed: string
  readonly sourceBuild: string
}) {
  return serializeWayvmExport(
    await createWayvmExport({
      exportedAt: TEST_TIMESTAMP,
      sourceAppVersion: "0.1.0",
      sourceBuild,
      playerData: createInitialPlayerData({
        schedulerSeed,
        createdAt: TEST_TIMESTAMP,
      }),
    }),
  )
}

async function waitForReadyCrucible(
  actor: ReturnType<typeof createRootActor>["actor"],
) {
  return waitFor(actor, (snapshot) => snapshot.matches({ Crucible: "Ready" }))
}

function requirePendingResetConfirmationId(
  actor: ReturnType<typeof createRootActor>["actor"],
) {
  const pendingResetReview = actor.getSnapshot().context.pendingResetReview
  if (!pendingResetReview) {
    throw new Error("Reset review was not prepared")
  }

  return pendingResetReview.confirmationId
}

async function commitOneBattle(
  actor: ReturnType<typeof createRootActor>["actor"],
) {
  actor.send({ type: "BATTLE.START_REQUESTED" })
  const profile = actor.getSnapshot().context.playerData?.profile
  if (!profile) {
    throw new Error("Battle profile did not initialize")
  }

  const [winnerId] = projectBattlePair(profile.activeDeck, profile.scheduler)
  actor.send({
    type: "BATTLE.WINNER_SELECTED",
    winnerId,
    expectedScheduler: profile.scheduler,
  })

  const committedProfile = (await waitForReadyCrucible(actor)).context
    .playerData?.profile
  if (!committedProfile) {
    throw new Error("Battle profile disappeared after selection")
  }

  return committedProfile
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

function createActorErrorPromise(
  actor: ReturnType<typeof createRootActor>["actor"],
) {
  return new Promise<unknown>((resolve) => {
    actor.subscribe({ error: resolve })
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
    const randomUuid = vi.fn(() => "00000000-0000-4000-8000-000000000001")
    const { actor } = await bootRootActor({
      schedulerSeed: "all-values-add-seed",
      randomUuid,
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
    expect(afterAddProfile.activeDeck.customValues[0]?.id).toBe(
      createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
    )
    expect(randomUuid).toHaveBeenCalledOnce()
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
      totalXp: 4,
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

  it("retries durable hydration failure without exporting invented Player Data or offering an unsafe return", async () => {
    let shouldFail = true
    const memoryStore = createInMemoryDurableStore()
    const durableStore = Object.freeze({
      readAll: async () => {
        if (shouldFail) {
          throw new Error("IndexedDB unavailable")
        }

        return memoryStore.readAll()
      },
      compareAndSwapVerified: memoryStore.compareAndSwapVerified,
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
    expect(snapshot.context.persistenceFailureOrigin).toBe("loading")
    expect(snapshot.context.battleProfileStoreState).toBeNull()

    actor.send({ type: "STORAGE_RECOVERY.EXPORT_REQUESTED" })
    actor.send({ type: "STORAGE_RECOVERY.RETURN_REQUESTED" })
    expect(
      actor.getSnapshot().matches({ PersistenceFailure: "Reviewing" }),
    ).toBe(true)
    expect(actor.getSnapshot().context.preparedDownload).toBeNull()

    shouldFail = false
    actor.send({ type: "STORAGE_RECOVERY.RETRY_REQUESTED" })
    await waitFor(actor, (candidate) => candidate.matches("Splash"))

    expect(actor.getSnapshot().context.persistenceFailureOrigin).toBeNull()
  })

  it("exports current first-run data and returns safely after durable initialization failure", async () => {
    let shouldFail = true
    const memoryStore = createInMemoryDurableStore()
    const durableStore = Object.freeze({
      readAll: memoryStore.readAll,
      compareAndSwapVerified: async (transaction) => {
        if (shouldFail) {
          throw new Error("Profile initialization failed")
        }

        return memoryStore.compareAndSwapVerified(transaction)
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
    expect(snapshot.context.persistenceFailureOrigin).toBe("initialization")
    expect(snapshot.context.battleProfileStoreState).toBeNull()

    actor.send({ type: "STORAGE_RECOVERY.EXPORT_REQUESTED" })
    const exportedSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ PersistenceFailure: "Reviewing" }) &&
        candidate.context.preparedDownload !== null,
    )
    await expect(
      decodeWayvmExport(
        exportedSnapshot.context.preparedDownload?.serialized ?? "",
      ),
    ).resolves.toMatchObject({
      playerData: {
        profile: { scheduler: { seed: "failed-initialization-seed" } },
      },
    })
    actor.send({ type: "RECOVERY.EXPORT_CONSUMED" })
    actor.send({ type: "STORAGE_RECOVERY.RETURN_REQUESTED" })
    expect(actor.getSnapshot().matches("Splash")).toBe(true)

    shouldFail = false
    actor.send({ type: "INTRODUCTION.COMPLETED" })
    await waitFor(actor, (candidate) => candidate.matches("Hub"))
    expect((await durableStore.readAll()).size).toBe(2)
  })

  it("retries durable initialization into a persisted Hub profile without discarding first-run data", async () => {
    let shouldFail = true
    const memoryStore = createInMemoryDurableStore()
    const durableStore = Object.freeze({
      readAll: memoryStore.readAll,
      compareAndSwapVerified: async (transaction) => {
        if (shouldFail) {
          throw new Error("Initialization retry fixture failed")
        }

        return memoryStore.compareAndSwapVerified(transaction)
      },
    }) satisfies DurableStoreAdapter
    const { actor } = createRootActor({ durableStore })
    actor.start()
    actor.send({
      type: "APP.HYDRATED",
      schedulerSeed: "initialization-retry-seed",
    })

    await waitFor(actor, (candidate) => candidate.matches("Splash"))
    actor.send({ type: "INTRODUCTION.COMPLETED" })
    const failureSnapshot = await waitFor(actor, (candidate) =>
      candidate.matches("PersistenceFailure"),
    )
    const firstRunPlayerData = failureSnapshot.context.playerData
    if (!firstRunPlayerData) {
      throw new Error("Initialization retry fixture did not retain Player Data")
    }

    shouldFail = false
    actor.send({ type: "STORAGE_RECOVERY.RETRY_REQUESTED" })
    const restoredSnapshot = await waitFor(actor, (candidate) =>
      candidate.matches("Hub"),
    )

    expect(restoredSnapshot.context.playerData).toStrictEqual(
      firstRunPlayerData,
    )
    expect(restoredSnapshot.context.persistenceFailureOrigin).toBeNull()
    expect((await durableStore.readAll()).size).toBe(2)
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
    expect(snapshot.context.persistenceFailureOrigin).toBe("crucible")
    expect(snapshot.context.playerData?.profile).toBe(priorProfile)
    expect(snapshot.context.pendingBattleProfileCommit).toBeNull()

    actor.send({ type: "STORAGE_RECOVERY.EXPORT_REQUESTED" })
    const exportedSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ PersistenceFailure: "Reviewing" }) &&
        candidate.context.preparedDownload !== null,
    )
    await expect(
      decodeWayvmExport(
        exportedSnapshot.context.preparedDownload?.serialized ?? "",
      ),
    ).resolves.toMatchObject({
      playerData: { profile: { scheduler: priorProfile.scheduler } },
    })
    actor.send({ type: "RECOVERY.EXPORT_CONSUMED" })
    actor.send({ type: "STORAGE_RECOVERY.RETURN_REQUESTED" })

    expect(actor.getSnapshot().matches("Hub")).toBe(true)
    expect(actor.getSnapshot().context.playerData?.profile).toBe(priorProfile)
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
      playerDataPortabilityCopy.exportSuccess,
    )

    actor.send({ type: "DATA_MANAGEMENT.EXPORT_CONSUMED" })

    expect(actor.getSnapshot().context.preparedDownload).toBeNull()
  })

  it("reports browser delivery failure without retaining prepared private bytes", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-platform-export-failure-seed",
    })
    const currentPlayerData = actor.getSnapshot().context.playerData

    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "DATA_MANAGEMENT.EXPORT_REQUESTED" })
    await waitFor(
      actor,
      (candidate) => candidate.context.preparedDownload !== null,
    )
    actor.send({
      type: "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED",
      issue: playerDataPortabilityCopy.exportFailure,
    })

    const snapshot = actor.getSnapshot()
    expect(snapshot.matches({ DataManagement: "Browsing" })).toBe(true)
    expect(snapshot.context.playerData).toBe(currentPlayerData)
    expect(snapshot.context.preparedDownload).toBeNull()
    expect(snapshot.context.portabilityIssue).toBe(
      playerDataPortabilityCopy.exportFailure,
    )
    expect(snapshot.context.portabilityNotice).toBeNull()

    actor.send({ type: "DATA_MANAGEMENT.IMPORT_FILE_READ_REQUESTED" })
    expect(actor.getSnapshot().context.playerData).toBe(currentPlayerData)
    expect(actor.getSnapshot().context.portabilityIssue).toBeNull()
  })

  it("surfaces export and pre-import backup creation failures without abandoning current data", async () => {
    const failingWayvmExportActor = fromPromise(async () => {
      throw new Error("Private backup creation failed")
    }) as typeof createWayvmExportActor
    const rootLogic = rootMachine.provide({
      actors: { createWayvmExport: failingWayvmExportActor },
    })
    const { actor } = await bootRootActor({
      schedulerSeed: "root-export-failure-seed",
      rootLogic,
    })
    const currentPlayerData = actor.getSnapshot().context.playerData

    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "DATA_MANAGEMENT.EXPORT_REQUESTED" })
    let failureSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "Browsing" }) &&
        candidate.context.portabilityIssue ===
          playerDataPortabilityCopy.exportFailure,
    )

    expect(failureSnapshot.context.playerData).toBe(currentPlayerData)
    expect(failureSnapshot.context.preparedDownload).toBeNull()

    const importBytes = await createSerializedImportFixture(
      "root-backup-failure-import-seed",
    )
    actor.send({
      type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
      serialized: importBytes,
    })
    await waitFor(actor, (candidate) =>
      candidate.matches({ DataManagement: "ReviewingImport" }),
    )
    actor.send({ type: "DATA_MANAGEMENT.IMPORT_CONFIRM_REQUESTED" })
    failureSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "ReviewingImport" }) &&
        candidate.context.portabilityIssue ===
          playerDataPortabilityCopy.exportFailure,
    )

    expect(failureSnapshot.context.playerData).toBe(currentPlayerData)
    expect(failureSnapshot.context.pendingImport).not.toBeNull()
    expect(failureSnapshot.context.preImportBackupBytes).toBeNull()
  })

  it("rejects empty import bytes through the recoverable malformed-file state", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-empty-import-seed",
    })
    const currentPlayerData = actor.getSnapshot().context.playerData

    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({
      type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
      serialized: "",
    })
    const failureSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "Browsing" }) &&
        candidate.context.portabilityIssue ===
          playerDataPortabilityCopy.importInvalid,
    )

    expect(failureSnapshot.context.playerData).toBe(currentPlayerData)
    expect(failureSnapshot.context.pendingImport).toBeNull()
  })

  it("fails loudly when an invalid event removes required pending import bytes", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-missing-import-bytes-seed",
    })
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    const invalidEvent = {
      type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
      serialized: null,
    } as unknown as Parameters<typeof actor.send>[0]

    expectActorEventError(actor, invalidEvent, "Import bytes are not prepared")
  })

  it("rejects a missing validated import before atomic replacement", async () => {
    const missingPreparedImportActor = fromPromise(
      async () => null as never,
    ) as typeof prepareWayvmImportActor
    const rootLogic = rootMachine.provide({
      actors: { prepareWayvmImport: missingPreparedImportActor },
    })
    const { actor, durableStore } = await bootRootActor({
      schedulerSeed: "root-missing-prepared-import-seed",
      rootLogic,
    })
    const currentPlayerData = actor.getSnapshot().context.playerData
    const entriesBeforeAttempt = await durableStore.readAll()

    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({
      type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
      serialized: "ignored-by-test-actor",
    })
    await waitFor(actor, (candidate) =>
      candidate.matches({ DataManagement: "ReviewingImport" }),
    )
    const actorError = createActorErrorPromise(actor)
    actor.send({ type: "DATA_MANAGEMENT.IMPORT_CONFIRM_REQUESTED" })

    await expect(actorError).resolves.toMatchObject({
      message: "Validated import data is not prepared",
    })
    expect(actor.getSnapshot().context.playerData).toBe(currentPlayerData)
    await expect(durableStore.readAll()).resolves.toEqual(entriesBeforeAttempt)
  })

  it("rejects missing pre-import backup bytes before atomic replacement", async () => {
    const emptyWayvmExportActor = fromPromise(async () =>
      Object.freeze({ filename: "empty-backup.json", serialized: "" }),
    ) as typeof createWayvmExportActor
    const rootLogic = rootMachine.provide({
      actors: { createWayvmExport: emptyWayvmExportActor },
    })
    const { actor, durableStore } = await bootRootActor({
      schedulerSeed: "root-missing-backup-bytes-seed",
      rootLogic,
    })
    const currentPlayerData = actor.getSnapshot().context.playerData
    const entriesBeforeAttempt = await durableStore.readAll()

    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({
      type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
      serialized: await createSerializedImportFixture(
        "root-missing-backup-import-seed",
      ),
    })
    await waitFor(actor, (candidate) =>
      candidate.matches({ DataManagement: "ReviewingImport" }),
    )
    const actorError = createActorErrorPromise(actor)
    actor.send({ type: "DATA_MANAGEMENT.IMPORT_CONFIRM_REQUESTED" })

    await expect(actorError).resolves.toMatchObject({
      message: "Pre-import backup bytes are not prepared",
    })
    expect(actor.getSnapshot().context.playerData).toBe(currentPlayerData)
    await expect(durableStore.readAll()).resolves.toEqual(entriesBeforeAttempt)
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
      playerDataPortabilityCopy.importInvalid,
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
    expect(target.actor.getSnapshot().context.portabilityNotice).toBe(
      playerDataPortabilityCopy.importCancelled,
    )

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
        candidate.matches("Hub") &&
        candidate.context.portabilityNotice ===
          playerDataPortabilityCopy.importSuccess,
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
        candidate.context.portabilityIssue ===
          playerDataPortabilityCopy.importRestoreFailure,
    )

    expect(failedSnapshot.context.playerData).toBe(targetPlayerData)
    expect(failedSnapshot.context.pendingImport).not.toBeNull()
    expect(failedSnapshot.context.preImportBackupBytes).toBeNull()

    shouldFail = false
    target.actor.send({ type: "DATA_MANAGEMENT.IMPORT_CONFIRM_REQUESTED" })
    const retriedSnapshot = await waitFor(
      target.actor,
      (candidate) =>
        candidate.matches("Hub") &&
        candidate.context.portabilityNotice ===
          playerDataPortabilityCopy.importSuccess,
    )

    expect(retriedSnapshot.context.portabilityIssue).toBeNull()
    expect(retriedSnapshot.context.playerData?.profile.scheduler.seed).toBe(
      "root-retry-source-seed",
    )
  })

  it("deletes every Custom Value only after the matching review confirmation", async () => {
    const randomUuid = vi
      .fn()
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000010")
      .mockReturnValueOnce("delete-custom-values-review")
    const { actor } = await bootRootActor({
      schedulerSeed: "root-delete-custom-values-seed",
      randomUuid,
    })

    actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })
    actor.send({
      type: "ALL_VALUES.ADD_REQUESTED",
      name: "Ingenuity",
      definition: "The disciplined practice of creating new solutions.",
    })
    const customValueSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ AllValues: "Browsing" }) &&
        candidate.context.playerData?.profile.activeDeck.customValues.length ===
          1,
    )
    const profileBeforeReset = customValueSnapshot.context.playerData?.profile
    if (!profileBeforeReset) {
      throw new Error("Custom Value profile was not prepared")
    }

    actor.send({ type: "ALL_VALUES.CLOSE_REQUESTED" })
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "CUSTOM_VALUE.DELETE_ALL_REQUESTED" })
    const confirmationId = requirePendingResetConfirmationId(actor)

    actor.send({
      type: "CUSTOM_VALUE.DELETE_ALL_CONFIRMED",
      confirmationId: "stale-delete-custom-values-review",
    })
    expect(
      actor.getSnapshot().matches({ DataManagement: "ReviewingReset" }),
    ).toBe(true)
    expect(actor.getSnapshot().context.playerData?.profile).toBe(
      profileBeforeReset,
    )

    actor.send({
      type: "CUSTOM_VALUE.DELETE_ALL_CONFIRMED",
      confirmationId,
    })
    const resetSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "Browsing" }) &&
        candidate.context.portabilityNotice ===
          "All Custom Values were deleted. Canonical value progress, achievements, and settings were kept.",
    )
    const resetProfile = resetSnapshot.context.playerData?.profile
    if (!resetProfile) {
      throw new Error("Custom Value deletion removed Player Data")
    }

    expect(resetProfile.activeDeck.customValues).toEqual([])
    expect(resetProfile.activeDeck.valueIds).toHaveLength(100)
    expect(resetProfile.scheduler.deckRevision).toBe(
      profileBeforeReset.scheduler.deckRevision + 1,
    )
    expect(resetProfile.scheduler.progressGeneration).toBe(
      profileBeforeReset.scheduler.progressGeneration,
    )
    expect(resetSnapshot.context.pendingResetReview).toBeNull()
  })

  it("resets levels and experience while preserving Custom Values achievements and settings", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-level-reset-seed",
    })
    const playedProfile = await commitOneBattle(actor)
    const playerDataBeforeReset = actor.getSnapshot().context.playerData
    if (!playerDataBeforeReset) {
      throw new Error("Played Player Data was not prepared")
    }

    actor.send({ type: "BATTLE.EXIT_REQUESTED" })
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "RESET.LEVELS_AND_EXPERIENCE_REQUESTED" })
    actor.send({
      type: "RESET.LEVELS_AND_EXPERIENCE_CONFIRMED",
      confirmationId: requirePendingResetConfirmationId(actor),
    })
    const resetSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "Browsing" }) &&
        candidate.context.portabilityNotice ===
          "Levels and experience were reset. Custom Values, achievements, and settings were kept.",
    )
    const resetPlayerData = resetSnapshot.context.playerData
    if (!resetPlayerData) {
      throw new Error("Level reset removed Player Data")
    }

    expect(resetPlayerData.profile.activeDeck).toEqual(playedProfile.activeDeck)
    expect(resetPlayerData.profile.scheduler.deckRevision).toBe(
      playedProfile.scheduler.deckRevision,
    )
    expect(resetPlayerData.profile.scheduler.progressGeneration).toBe(
      playedProfile.scheduler.progressGeneration + 1,
    )
    expect(resetPlayerData.profile.history).toEqual([])
    expect(resetPlayerData.profile.redo).toEqual([])
    expect(
      Array.from(resetPlayerData.profile.progressById.values()).every(
        ({ totalXp, profileWins, profileComparisons, currentCycleWins }) =>
          totalXp === 0 &&
          profileWins === 0 &&
          profileComparisons === 0 &&
          currentCycleWins === 0,
      ),
    ).toBe(true)
    expect(resetPlayerData.achievements.unlocks).toEqual(
      playerDataBeforeReset.achievements.unlocks,
    )
    expect(resetPlayerData.achievements.progress.lifetimeBattleCount).toBe(
      playerDataBeforeReset.achievements.progress.lifetimeBattleCount,
    )
    expect(resetPlayerData.settings).toEqual(playerDataBeforeReset.settings)
  })

  it("resets achievements while retaining ranking and reachable replay guards", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-achievement-reset-seed",
    })
    await commitOneBattle(actor)
    actor.send({ type: "BATTLE.UNDO_REQUESTED" })
    const undoneSnapshot = await waitForReadyCrucible(actor)
    const playerDataBeforeReset = undoneSnapshot.context.playerData
    if (!playerDataBeforeReset) {
      throw new Error("Undo did not retain Player Data")
    }
    const reachableBattleIds = [
      ...playerDataBeforeReset.profile.history,
      ...playerDataBeforeReset.profile.redo,
    ].map(({ battleId }) => battleId)

    actor.send({ type: "BATTLE.EXIT_REQUESTED" })
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "RESET.ACHIEVEMENTS_REQUESTED" })
    actor.send({
      type: "RESET.ACHIEVEMENTS_CONFIRMED",
      confirmationId: requirePendingResetConfirmationId(actor),
    })
    const resetSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "Browsing" }) &&
        candidate.context.portabilityNotice ===
          "Achievements and achievement progress were reset. Your values, ranking, and settings were kept.",
    )
    const resetPlayerData = resetSnapshot.context.playerData
    if (!resetPlayerData) {
      throw new Error("Achievement reset removed Player Data")
    }

    expect(resetPlayerData.profile).toEqual(playerDataBeforeReset.profile)
    expect(resetPlayerData.settings).toEqual(playerDataBeforeReset.settings)
    expect(resetPlayerData.achievements.unlocks).toEqual([])
    expect(resetPlayerData.achievements.presentedAchievementIds).toEqual([])
    expect(resetPlayerData.achievements.progress).toMatchObject({
      achievementProgressGeneration:
        playerDataBeforeReset.achievements.progress
          .achievementProgressGeneration + 1,
      lifetimeBattleCount: 0,
      countedBattleWindow: { ids: reachableBattleIds },
    })
  })

  it("invalidates cancelled and cross-scope reset confirmations", async () => {
    const randomUuid = vi
      .fn()
      .mockReturnValueOnce("first-reset-review")
      .mockReturnValueOnce("second-reset-review")
    const { actor } = await bootRootActor({
      schedulerSeed: "root-stale-reset-review-seed",
      randomUuid,
    })
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "RESET.LEVELS_AND_EXPERIENCE_REQUESTED" })
    const firstConfirmationId = requirePendingResetConfirmationId(actor)

    actor.send({ type: "DATA_MANAGEMENT.RESET_CANCEL_REQUESTED" })
    expect(actor.getSnapshot().context.pendingResetReview).toBeNull()
    actor.send({ type: "RESET.ACHIEVEMENTS_REQUESTED" })
    const secondConfirmationId = requirePendingResetConfirmationId(actor)
    const playerDataBeforeReset = actor.getSnapshot().context.playerData

    actor.send({
      type: "RESET.ACHIEVEMENTS_CONFIRMED",
      confirmationId: firstConfirmationId,
    })
    actor.send({
      type: "RESET.LEVELS_AND_EXPERIENCE_CONFIRMED",
      confirmationId: secondConfirmationId,
    })
    expect(
      actor.getSnapshot().matches({ DataManagement: "ReviewingReset" }),
    ).toBe(true)
    expect(actor.getSnapshot().context.playerData).toBe(playerDataBeforeReset)

    actor.send({
      type: "RESET.ACHIEVEMENTS_CONFIRMED",
      confirmationId: secondConfirmationId,
    })
    const resetSnapshot = await waitFor(actor, (candidate) =>
      candidate.matches({ DataManagement: "Browsing" }),
    )

    expect(firstConfirmationId).not.toBe(secondConfirmationId)
    expect(
      resetSnapshot.context.playerData?.achievements.progress
        .achievementProgressGeneration,
    ).toBe(
      (playerDataBeforeReset?.achievements.progress
        .achievementProgressGeneration ?? 0) + 1,
    )
  })

  it("exports from reset review and requires the exact phrase before complete local erasure", async () => {
    const { actor, durableStore } = await bootRootActor({
      schedulerSeed: "root-complete-erasure-seed",
    })
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "DELETE_ALL_DATA.REQUESTED" })
    const confirmationId = requirePendingResetConfirmationId(actor)

    actor.send({ type: "DATA_MANAGEMENT.EXPORT_REQUESTED" })
    const exportedSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "ReviewingReset" }) &&
        candidate.context.preparedDownload !== null,
    )
    expect(exportedSnapshot.context.pendingResetReview).toMatchObject({
      resetKind: "delete-all-data",
      confirmationId,
    })
    expect(exportedSnapshot.context.portabilityNotice).toBe(
      "Your private backup is ready. Review the reset when you are ready.",
    )

    actor.send({ type: "DATA_MANAGEMENT.EXPORT_CONSUMED" })
    actor.send({
      type: "DELETE_ALL_DATA.CONFIRMED",
      phrase: "I understand this cannot be undone.",
    })
    expect(
      actor.getSnapshot().matches({ DataManagement: "ReviewingReset" }),
    ).toBe(true)
    expect((await durableStore.readAll()).size).toBeGreaterThan(0)

    actor.send({
      type: "DELETE_ALL_DATA.CONFIRMED",
      phrase: DELETE_ALL_DATA_ACKNOWLEDGMENT,
    })
    const erasedSnapshot = await waitFor(actor, (candidate) =>
      candidate.matches("Splash"),
    )

    expect(await durableStore.readAll()).toEqual(new Map())
    expect(erasedSnapshot.context.battleProfileStoreState).toBeNull()
    expect(erasedSnapshot.context.pendingResetReview).toBeNull()
    expect(erasedSnapshot.context.portabilityNotice).toBe(
      "All local WAYVM player data was deleted.",
    )
    expect(
      erasedSnapshot.context.playerData?.profile.activeDeck.valueIds,
    ).toHaveLength(100)

    actor.send({ type: "INTRODUCTION.COMPLETED" })
    await waitFor(actor, (candidate) => candidate.matches("Hub"))
    expect((await durableStore.readAll()).size).toBe(2)
  })

  it("retains the reviewed reset and current data after a failed write so the player can retry", async () => {
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
      schedulerSeed: "root-reset-retry-seed",
      durableStore,
    })
    const playerDataBeforeReset = actor.getSnapshot().context.playerData
    const entriesBeforeReset = await durableStore.readAll()
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "RESET.ACHIEVEMENTS_REQUESTED" })
    const confirmationId = requirePendingResetConfirmationId(actor)
    const confirmationEvent = {
      type: "RESET.ACHIEVEMENTS_CONFIRMED" as const,
      confirmationId,
    }

    shouldFail = true
    actor.send(confirmationEvent)
    const failureSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "ReviewingReset" }) &&
        candidate.context.portabilityIssue === "Scoped reset failed",
    )

    expect(failureSnapshot.context.playerData).toBe(playerDataBeforeReset)
    expect(failureSnapshot.context.pendingResetReview).toMatchObject({
      resetKind: "reset-achievements",
      confirmationId,
    })
    await expect(durableStore.readAll()).resolves.toEqual(entriesBeforeReset)

    shouldFail = false
    actor.send(confirmationEvent)
    const retriedSnapshot = await waitFor(actor, (candidate) =>
      candidate.matches({ DataManagement: "Browsing" }),
    )

    expect(retriedSnapshot.context.portabilityIssue).toBeNull()
    expect(retriedSnapshot.context.pendingResetReview).toBeNull()
    expect(
      retriedSnapshot.context.playerData?.achievements.progress
        .achievementProgressGeneration,
    ).toBe(
      (playerDataBeforeReset?.achievements.progress
        .achievementProgressGeneration ?? 0) + 1,
    )
  })

  it("keeps reset review open when Delete All Custom Values has nothing to delete", async () => {
    const { actor, durableStore } = await bootRootActor({
      schedulerSeed: "root-empty-custom-reset-seed",
    })
    const playerDataBeforeReset = actor.getSnapshot().context.playerData
    const entriesBeforeReset = await durableStore.readAll()
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "CUSTOM_VALUE.DELETE_ALL_REQUESTED" })
    const confirmationId = requirePendingResetConfirmationId(actor)
    actor.send({
      type: "CUSTOM_VALUE.DELETE_ALL_CONFIRMED",
      confirmationId,
    })
    const failureSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "ReviewingReset" }) &&
        candidate.context.portabilityIssue ===
          "There are no Custom Values to delete",
    )

    expect(failureSnapshot.context.playerData).toBe(playerDataBeforeReset)
    expect(failureSnapshot.context.pendingResetReview).toMatchObject({
      resetKind: "delete-all-custom-values",
      confirmationId,
    })
    await expect(durableStore.readAll()).resolves.toEqual(entriesBeforeReset)
  })

  it("fails loudly when the confirmation identity adapter returns an empty value", async () => {
    const { actor } = await bootRootActor({
      schedulerSeed: "root-empty-reset-confirmation-seed",
      randomUuid: () => "",
    })
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    const actorError = createActorErrorPromise(actor)

    actor.send({ type: "RESET.ACHIEVEMENTS_REQUESTED" })

    await expect(actorError).resolves.toMatchObject({
      message: "Reset confirmation ID is required",
    })
  })

  it("fails loudly if a scoped reset transition loses its prepared review", async () => {
    const rootLogic = rootMachine.provide({
      guards: {
        canConfirmAchievementsReset: ({ context }) => {
          context.pendingResetReview = null
          return true
        },
      },
    })
    const { actor } = await bootRootActor({
      schedulerSeed: "root-missing-reset-review-seed",
      rootLogic,
    })
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "RESET.ACHIEVEMENTS_REQUESTED" })
    const confirmationId = requirePendingResetConfirmationId(actor)
    const actorError = createActorErrorPromise(actor)

    actor.send({
      type: "RESET.ACHIEVEMENTS_CONFIRMED",
      confirmationId,
    })

    await expect(actorError).resolves.toMatchObject({
      message: "Reset review is not prepared",
    })
  })

  it("fails loudly if complete erasure reaches the scoped reset actor", async () => {
    const rootLogic = rootMachine.provide({
      guards: {
        canConfirmAchievementsReset: ({ context }) => {
          context.pendingResetReview = Object.freeze({
            resetKind: "delete-all-data",
            confirmationId: "invalid-scoped-reset-review",
          })
          return true
        },
      },
    })
    const { actor } = await bootRootActor({
      schedulerSeed: "root-wrong-reset-scope-seed",
      rootLogic,
    })
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "RESET.ACHIEVEMENTS_REQUESTED" })
    const confirmationId = requirePendingResetConfirmationId(actor)
    const actorError = createActorErrorPromise(actor)

    actor.send({
      type: "RESET.ACHIEVEMENTS_CONFIRMED",
      confirmationId,
    })

    await expect(actorError).resolves.toMatchObject({
      message: "Complete data erasure is not a scoped reset",
    })
  })

  it("retains reset review after private backup export fails", async () => {
    const failingWayvmExportActor = fromPromise(async () => {
      throw new Error("Reset backup export failed")
    }) as typeof createWayvmExportActor
    const rootLogic = rootMachine.provide({
      actors: { createWayvmExport: failingWayvmExportActor },
    })
    const { actor } = await bootRootActor({
      schedulerSeed: "root-reset-export-failure-seed",
      rootLogic,
    })
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "RESET.LEVELS_AND_EXPERIENCE_REQUESTED" })
    const confirmationId = requirePendingResetConfirmationId(actor)

    actor.send({ type: "DATA_MANAGEMENT.EXPORT_REQUESTED" })
    const failureSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "ReviewingReset" }) &&
        candidate.context.portabilityIssue === "Reset backup export failed",
    )

    expect(failureSnapshot.context.pendingResetReview).toMatchObject({
      resetKind: "reset-levels-and-experience",
      confirmationId,
    })
    expect(failureSnapshot.context.preparedDownload).toBeNull()
  })

  it("retains reset review after the scoped reset actor fails", async () => {
    const failingScopedResetActor = fromPromise(async () => {
      throw new Error("Scoped reset actor failed")
    }) as typeof applyScopedPlayerDataResetActor
    const rootLogic = rootMachine.provide({
      actors: { applyScopedPlayerDataReset: failingScopedResetActor },
    })
    const { actor } = await bootRootActor({
      schedulerSeed: "root-reset-actor-failure-seed",
      rootLogic,
    })
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "RESET.ACHIEVEMENTS_REQUESTED" })
    const confirmationId = requirePendingResetConfirmationId(actor)

    actor.send({
      type: "RESET.ACHIEVEMENTS_CONFIRMED",
      confirmationId,
    })
    const failureSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "ReviewingReset" }) &&
        candidate.context.portabilityIssue === "Scoped reset actor failed",
    )

    expect(failureSnapshot.context.pendingResetReview).toMatchObject({
      resetKind: "reset-achievements",
      confirmationId,
    })
    expect(failureSnapshot.context.playerData).not.toBeNull()
  })

  it("retains complete-erasure review and durable data after the erasure actor fails", async () => {
    const failingDeleteAllPlayerDataActor = fromPromise(async () => {
      throw new Error("Complete erasure failed")
    }) as typeof deleteAllPlayerDataActor
    const rootLogic = rootMachine.provide({
      actors: { deleteAllPlayerData: failingDeleteAllPlayerDataActor },
    })
    const { actor, durableStore } = await bootRootActor({
      schedulerSeed: "root-erasure-actor-failure-seed",
      rootLogic,
    })
    const entriesBeforeAttempt = await durableStore.readAll()
    const playerDataBeforeAttempt = actor.getSnapshot().context.playerData
    actor.send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    actor.send({ type: "DELETE_ALL_DATA.REQUESTED" })
    const confirmationId = requirePendingResetConfirmationId(actor)

    actor.send({
      type: "DELETE_ALL_DATA.CONFIRMED",
      phrase: DELETE_ALL_DATA_ACKNOWLEDGMENT,
    })
    const failureSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ DataManagement: "ReviewingReset" }) &&
        candidate.context.portabilityIssue === "Complete erasure failed",
    )

    expect(failureSnapshot.context.pendingResetReview).toMatchObject({
      resetKind: "delete-all-data",
      confirmationId,
    })
    expect(failureSnapshot.context.playerData).toBe(playerDataBeforeAttempt)
    await expect(durableStore.readAll()).resolves.toEqual(entriesBeforeAttempt)
  })

  it("returns a failed battle write to the unchanged pair so the player can retry the choice", async () => {
    const memoryStore = createInMemoryDurableStore()
    let shouldFail = false
    const durableStore = Object.freeze({
      readAll: memoryStore.readAll,
      compareAndSwapVerified: async (transaction) => {
        if (shouldFail) {
          throw new Error("Battle retry fixture failed")
        }

        return memoryStore.compareAndSwapVerified(transaction)
      },
    }) satisfies DurableStoreAdapter
    const { actor } = await bootRootActor({
      durableStore,
      schedulerSeed: "root-battle-retry-seed",
    })

    actor.send({ type: "BATTLE.START_REQUESTED" })
    const priorProfile = actor.getSnapshot().context.playerData?.profile
    if (!priorProfile) {
      throw new Error("Battle retry profile did not initialize")
    }
    const priorScheduler = priorProfile.scheduler
    if (priorScheduler.scheduleKind !== "full-cycle") {
      throw new Error("Battle retry fixture expected a full-cycle scheduler")
    }
    const [winnerId] = projectScheduledPair(
      priorProfile.activeDeck,
      priorScheduler,
    ).pair

    shouldFail = true
    actor.send({
      type: "BATTLE.WINNER_SELECTED",
      winnerId,
      expectedScheduler: priorScheduler,
    })
    await waitFor(actor, (candidate) =>
      candidate.matches({ PersistenceFailure: "Reviewing" }),
    )

    shouldFail = false
    actor.send({ type: "STORAGE_RECOVERY.RETRY_REQUESTED" })
    const retrySnapshot = await waitForReadyCrucible(actor)

    expect(retrySnapshot.context.playerData?.profile).toBe(priorProfile)
    expect(
      projectScheduledPair(priorProfile.activeDeck, priorScheduler).pair,
    ).toContain(winnerId)

    actor.send({
      type: "BATTLE.WINNER_SELECTED",
      winnerId,
      expectedScheduler: priorScheduler,
    })
    const committedSnapshot = await waitForReadyCrucible(actor)

    expect(
      committedSnapshot.context.playerData?.profile.progressById.get(winnerId)
        ?.totalXp,
    ).toBe(4)
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
    const serializedBackup = await createSerializedRecoveryBackup({
      schedulerSeed: "retained-recovery-backup",
      sourceBuild: "retained-backup-build",
    })
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
    expect(reviewSnapshot.context.pendingRecoveryImportSource).toBe(
      "last-known-good",
    )

    actor.send({ type: "RECOVERY.IMPORT_CONFIRM_REQUESTED" })
    const restoredSnapshot = await waitFor(actor, (candidate) =>
      candidate.matches("Hub"),
    )

    expect(restoredSnapshot.context.playerData?.profile.scheduler.seed).toBe(
      "retained-recovery-backup",
    )
    expect(restoredSnapshot.context.recoveryEntries).toBeNull()
    expect(restoredSnapshot.context.portabilityNotice).toBe(
      "Last known-good save restored.",
    )
    expect(
      (await durableStore.readAll()).has(BATTLE_PROFILE_MANIFEST_KEY),
    ).toBe(true)
    expect(
      (await durableStore.readAll()).has(BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY),
    ).toBe(false)
  })

  it("keeps captured corruption recoverable when retained backup bytes are empty", async () => {
    const { actor, durableStore } = await bootCorruptRootActor({
      initialEntries: [
        [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
        [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
        [BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY, ""],
      ],
    })
    const capturedEntries = await durableStore.readAll()

    actor.send({ type: "RECOVERY.RESTORE_BACKUP_REQUESTED" })
    const failureSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ PersistenceFailure: "Reviewing" }) &&
        candidate.context.portabilityIssue !== null,
    )

    expect(failureSnapshot.context.recoveryEntries).toEqual(capturedEntries)
    expect(failureSnapshot.context.pendingRecoveryImportSource).toBeNull()
    await expect(durableStore.readAll()).resolves.toEqual(capturedEntries)
  })

  it("tracks a selected recovery backup through preview, clears it on cancellation, and preserves its exact replacement outcome", async () => {
    const serializedBackup = await createSerializedRecoveryBackup({
      schedulerSeed: "selected-recovery-backup",
      sourceBuild: "selected-backup-build",
    })
    const { actor } = await bootCorruptRootActor({
      initialEntries: [
        [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
        [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      ],
    })

    actor.send({
      type: "RECOVERY.IMPORT_PREPARE_REQUESTED",
      serialized: serializedBackup,
    })
    const reviewSnapshot = await waitFor(actor, (candidate) =>
      candidate.matches({ PersistenceFailure: "ReviewingImport" }),
    )

    expect(reviewSnapshot.context.pendingImport?.preview.sourceBuild).toBe(
      "selected-backup-build",
    )
    expect(reviewSnapshot.context.pendingRecoveryImportSource).toBe(
      "selected-backup",
    )

    actor.send({ type: "RECOVERY.IMPORT_CANCEL_REQUESTED" })

    expect(
      actor.getSnapshot().matches({ PersistenceFailure: "Reviewing" }),
    ).toBe(true)
    expect(actor.getSnapshot().context.pendingRecoveryImportSource).toBeNull()

    actor.send({
      type: "RECOVERY.IMPORT_PREPARE_REQUESTED",
      serialized: serializedBackup,
    })
    await waitFor(actor, (candidate) =>
      candidate.matches({ PersistenceFailure: "ReviewingImport" }),
    )
    actor.send({ type: "RECOVERY.IMPORT_CONFIRM_REQUESTED" })
    const restoredSnapshot = await waitFor(actor, (candidate) =>
      candidate.matches("Hub"),
    )

    expect(restoredSnapshot.context.playerData?.profile.scheduler.seed).toBe(
      "selected-recovery-backup",
    )
    expect(restoredSnapshot.context.portabilityNotice).toBe(
      "Your backup replaced the unreadable local data.",
    )
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
    expect(rejectedSnapshot.context.pendingRecoveryImportSource).toBeNull()
    expect(rejectedSnapshot.context.portabilityIssue).toBe(
      "Persisted JSON must use tuple arrays rather than objects",
    )
    await expect(durableStore.readAll()).resolves.toEqual(capturedEntries)
  })

  it("requires the canonical deletion acknowledgement before erasing captured corrupt records", async () => {
    const { actor, durableStore } = await bootCorruptRootActor({
      initialEntries: [
        [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
        [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      ],
    })

    actor.send({
      type: "RECOVERY.DELETE_ALL_REQUESTED",
      phrase: "I am not acknowledging this deletion.",
    })
    expect(
      actor.getSnapshot().matches({ PersistenceFailure: "Reviewing" }),
    ).toBe(true)
    expect((await durableStore.readAll()).size).toBe(2)

    actor.send({
      type: "RECOVERY.DELETE_ALL_REQUESTED",
      phrase: DELETE_ALL_DATA_ACKNOWLEDGMENT,
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
      phrase: DELETE_ALL_DATA_ACKNOWLEDGMENT,
    })

    expect(
      actor.getSnapshot().matches({ PersistenceFailure: "Reviewing" }),
    ).toBe(true)
    expect(actor.getSnapshot().context.recoveryEntries).toBeNull()
    expect(actor.getSnapshot().context.preparedDownload).toBeNull()
    expect(actor.getSnapshot().context.pendingImport).toBeNull()
    expect(compareAndSwapCallCount).toBe(0)
  })

  it("retains the valid committed battle snapshot when current-data export fails", async () => {
    const memoryStore = createInMemoryDurableStore()
    let shouldFailCommit = false
    const durableStore = Object.freeze({
      readAll: memoryStore.readAll,
      compareAndSwapVerified: async (transaction) => {
        if (shouldFailCommit) {
          throw new Error("Battle export fixture failed")
        }

        return memoryStore.compareAndSwapVerified(transaction)
      },
    }) satisfies DurableStoreAdapter
    const failingWayvmExportActor = fromPromise(async () => {
      throw new Error("Current backup export failed")
    }) as typeof createWayvmExportActor
    const rootLogic = rootMachine.provide({
      actors: { createWayvmExport: failingWayvmExportActor },
    })
    const { actor } = await bootRootActor({
      durableStore,
      rootLogic,
      schedulerSeed: "root-current-data-export-failure-seed",
    })
    actor.send({ type: "BATTLE.START_REQUESTED" })
    const committedProfile = actor.getSnapshot().context.playerData?.profile
    if (!committedProfile) {
      throw new Error("Current-data export fixture did not initialize")
    }
    const committedScheduler = committedProfile.scheduler
    if (committedScheduler.scheduleKind !== "full-cycle") {
      throw new Error(
        "Current-data export fixture expected a full-cycle scheduler",
      )
    }
    const [winnerId] = projectScheduledPair(
      committedProfile.activeDeck,
      committedScheduler,
    ).pair

    shouldFailCommit = true
    actor.send({
      type: "BATTLE.WINNER_SELECTED",
      winnerId,
      expectedScheduler: committedScheduler,
    })
    await waitFor(actor, (candidate) =>
      candidate.matches({ PersistenceFailure: "Reviewing" }),
    )

    actor.send({ type: "STORAGE_RECOVERY.EXPORT_REQUESTED" })
    const failureSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ PersistenceFailure: "Reviewing" }) &&
        candidate.context.portabilityIssue === "Current backup export failed",
    )

    expect(failureSnapshot.context.playerData?.profile).toBe(committedProfile)
    expect(failureSnapshot.context.preparedDownload).toBeNull()
  })

  it("retains captured corruption after diagnostic export failure and reports a platform delivery failure", async () => {
    const failingRecoveryBundleActor = fromPromise(async () => {
      throw new Error("Diagnostic export failed")
    }) as typeof createRecoveryBundleActor
    const rootLogic = rootMachine.provide({
      actors: { createRecoveryBundle: failingRecoveryBundleActor },
    })
    const { actor, durableStore } = await bootCorruptRootActor({
      initialEntries: [
        [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
        [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      ],
      rootLogic,
    })
    const capturedEntries = await durableStore.readAll()

    actor.send({ type: "RECOVERY.EXPORT_REQUESTED" })
    const exportFailureSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ PersistenceFailure: "Reviewing" }) &&
        candidate.context.portabilityIssue === "Diagnostic export failed",
    )

    expect(exportFailureSnapshot.context.recoveryEntries).toEqual(
      capturedEntries,
    )
    expect(exportFailureSnapshot.context.preparedDownload).toBeNull()

    actor.send({
      type: "RECOVERY.PLATFORM_FAILURE_REPORTED",
      issue: "Native file sharing was canceled",
    })

    expect(actor.getSnapshot().context.portabilityIssue).toBe(
      "Native file sharing was canceled",
    )
    await expect(durableStore.readAll()).resolves.toEqual(capturedEntries)
  })

  it("retains the validated recovery review and captured corruption when replacement fails", async () => {
    const failingRecoveryReplacementActor = fromPromise(async () => {
      throw new Error("Recovery replacement failed")
    }) as typeof replaceUnrecoverablePlayerDataActor
    const rootLogic = rootMachine.provide({
      actors: {
        replaceUnrecoverablePlayerData: failingRecoveryReplacementActor,
      },
    })
    const serializedBackup = await createSerializedRecoveryBackup({
      schedulerSeed: "replacement-retry-backup",
      sourceBuild: "replacement-retry-build",
    })
    const { actor, durableStore } = await bootCorruptRootActor({
      initialEntries: [
        [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
        [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      ],
      rootLogic,
    })
    const capturedEntries = await durableStore.readAll()

    actor.send({
      type: "RECOVERY.IMPORT_PREPARE_REQUESTED",
      serialized: serializedBackup,
    })
    await waitFor(actor, (candidate) =>
      candidate.matches({ PersistenceFailure: "ReviewingImport" }),
    )
    actor.send({ type: "RECOVERY.IMPORT_CONFIRM_REQUESTED" })
    const failureSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ PersistenceFailure: "ReviewingImport" }) &&
        candidate.context.portabilityIssue === "Recovery replacement failed",
    )

    expect(failureSnapshot.context.pendingImport?.preview.sourceBuild).toBe(
      "replacement-retry-build",
    )
    expect(failureSnapshot.context.recoveryEntries).toEqual(capturedEntries)
    await expect(durableStore.readAll()).resolves.toEqual(capturedEntries)
  })

  it("retains captured corruption when acknowledged recovery erasure fails", async () => {
    const failingRecoveryDeleteActor = fromPromise(async () => {
      throw new Error("Recovery deletion failed")
    }) as typeof deleteUnrecoverablePlayerDataActor
    const rootLogic = rootMachine.provide({
      actors: { deleteUnrecoverablePlayerData: failingRecoveryDeleteActor },
    })
    const { actor, durableStore } = await bootCorruptRootActor({
      initialEntries: [
        [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
        [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      ],
      rootLogic,
    })
    const capturedEntries = await durableStore.readAll()

    actor.send({
      type: "RECOVERY.DELETE_ALL_REQUESTED",
      phrase: DELETE_ALL_DATA_ACKNOWLEDGMENT,
    })
    const failureSnapshot = await waitFor(
      actor,
      (candidate) =>
        candidate.matches({ PersistenceFailure: "Reviewing" }) &&
        candidate.context.portabilityIssue === "Recovery deletion failed",
    )

    expect(failureSnapshot.context.recoveryEntries).toEqual(capturedEntries)
    await expect(durableStore.readAll()).resolves.toEqual(capturedEntries)
  })

  it("fails loudly if diagnostic export loses captured recovery entries after its guard", async () => {
    const rootLogic = rootMachine.provide({
      guards: {
        hasRecoveryEntries: ({ context }) => {
          context.recoveryEntries = null
          return true
        },
      },
    })
    const { actor } = await bootCorruptRootActor({
      initialEntries: [
        [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
        [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      ],
      rootLogic,
    })
    const actorError = createActorErrorPromise(actor)

    actor.send({ type: "RECOVERY.EXPORT_REQUESTED" })

    await expect(actorError).resolves.toMatchObject({
      message: "Captured recovery entries are unavailable",
    })
  })

  it("fails loudly if retained-backup recovery loses its backup after the guard", async () => {
    const rootLogic = rootMachine.provide({
      guards: {
        hasStoredRecoveryBackup: ({ context }) => {
          context.recoveryEntries = new Map()
          return true
        },
      },
    })
    const { actor } = await bootCorruptRootActor({
      initialEntries: [
        [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
        [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
        [BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY, "retained-backup"],
      ],
      rootLogic,
    })
    const actorError = createActorErrorPromise(actor)

    actor.send({ type: "RECOVERY.RESTORE_BACKUP_REQUESTED" })

    await expect(actorError).resolves.toMatchObject({
      message: "A stored recovery backup is unavailable",
    })
  })
})
