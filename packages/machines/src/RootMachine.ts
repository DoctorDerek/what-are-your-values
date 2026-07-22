import type { ValueId } from "@game/data/src/Value"
import { assign, setup } from "xstate"
import { createInitialBattleProfile, type BattleProfile } from "./BattleProfile"
import {
  createBattleChoiceCommit,
  createBattleRedoCommit,
  createBattleUndoCommit,
  type BattleProfileCommit,
} from "./BattleProfileCommit"
import {
  commitBattleProfileEventActor,
  hydrateBattleProfileActor,
  initializeBattleProfileActor,
} from "./BattleProfilePersistenceActors"
import type { BattleProfileStoreState } from "./BattleProfileStore"
import {
  DurableStoreConflictError,
  type DurableStoreAdapter,
} from "./DurableStoreAdapter"
import {
  projectScheduledPair,
  type SchedulerRestorePoint,
} from "./PairScheduler"
import { areSchedulerIdentitiesEqual } from "./SchedulerIdentity"
import type { StorageAdapter } from "./StorageAdapter"

type RootMachineContext = {
  readonly storage: StorageAdapter
  readonly durableStore: DurableStoreAdapter
  readonly appVersion: string
  readonly now: () => string
  uuid: string | null
  battleProfile: BattleProfile | null
  battleProfileStoreState: BattleProfileStoreState | null
  pendingBattleProfileCommit: BattleProfileCommit | null
  persistenceIssue: string | null
  shouldSaveIntroductionId: boolean
}

type RootMachineEvent =
  | {
      type: "APP.HYDRATED"
      uuid: string | null
      schedulerSeed: string
    }
  | { type: "INTRODUCTION.COMPLETED"; uuid: string }
  | { type: "BATTLE.START_REQUESTED" }
  | { type: "ALL_VALUES.OPEN_REQUESTED" }
  | { type: "ALL_VALUES.CLOSE_REQUESTED" }
  | {
      type: "BATTLE.WINNER_SELECTED"
      winnerId: ValueId
      expectedScheduler: SchedulerRestorePoint
    }
  | { type: "BATTLE.UNDO_REQUESTED" }
  | { type: "BATTLE.REDO_REQUESTED" }
  | { type: "BATTLE.EXIT_REQUESTED" }

type RootMachineInput = {
  readonly storage: StorageAdapter
  readonly durableStore: DurableStoreAdapter
  readonly appVersion: string
  readonly now: () => string
}

function requireBattleProfile(context: RootMachineContext) {
  if (!context.battleProfile) {
    throw new Error("Battle profile is not initialized")
  }

  return context.battleProfile
}

function requireBattleProfileStoreState(context: RootMachineContext) {
  if (!context.battleProfileStoreState) {
    throw new Error("Battle Profile durable state is not initialized")
  }

  return context.battleProfileStoreState
}

function requirePendingBattleProfileCommit(context: RootMachineContext) {
  if (!context.pendingBattleProfileCommit) {
    throw new Error("Battle Profile durable commit is not prepared")
  }

  return context.pendingBattleProfileCommit
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export const rootMachine = setup({
  types: {
    context: {} as RootMachineContext,
    events: {} as RootMachineEvent,
    input: {} as RootMachineInput,
  },
  actors: {
    hydrateBattleProfile: hydrateBattleProfileActor,
    initializeBattleProfile: initializeBattleProfileActor,
    commitBattleProfileEvent: commitBattleProfileEventActor,
  },
  guards: {
    isCurrentBattleSelection: ({ context, event }) => {
      if (event.type !== "BATTLE.WINNER_SELECTED" || !context.battleProfile) {
        return false
      }

      if (
        !areSchedulerIdentitiesEqual(
          context.battleProfile.scheduler,
          event.expectedScheduler,
        )
      ) {
        return false
      }

      return projectScheduledPair(
        context.battleProfile.activeDeck,
        context.battleProfile.scheduler,
      ).pair.includes(event.winnerId)
    },
    canUndoBattle: ({ context }) =>
      (context.battleProfile?.history.length ?? 0) > 0,
    canRedoBattle: ({ context }) =>
      (context.battleProfile?.redo.length ?? 0) > 0,
  },
  actions: {
    saveIntroductionId: ({ context }) => {
      if (!context.shouldSaveIntroductionId) {
        return
      }

      if (!context.uuid) {
        throw new Error("Introduction completion is missing a UUID")
      }

      context.storage.setItem("wayvm_uuid", context.uuid)
    },
  },
}).createMachine({
  id: "root",
  initial: "Hydrating",
  context: ({ input }) => ({
    uuid: null,
    battleProfile: null,
    battleProfileStoreState: null,
    pendingBattleProfileCommit: null,
    persistenceIssue: null,
    shouldSaveIntroductionId: false,
    storage: input.storage,
    durableStore: input.durableStore,
    appVersion: input.appVersion,
    now: input.now,
  }),
  states: {
    Hydrating: {
      on: {
        "APP.HYDRATED": {
          target: "LoadingProfile",
          actions: assign({
            uuid: ({ event }) => event.uuid,
            battleProfile: ({ event }) =>
              createInitialBattleProfile(event.schedulerSeed),
            persistenceIssue: null,
            shouldSaveIntroductionId: false,
          }),
        },
      },
    },
    LoadingProfile: {
      invoke: {
        src: "hydrateBattleProfile",
        input: ({ context }) => ({
          store: context.durableStore,
          appVersion: context.appVersion,
        }),
        onDone: [
          {
            guard: ({ event }) => event.output.status === "ready",
            target: "Hub",
            actions: assign({
              battleProfile: ({ event }) => {
                if (event.output.status !== "ready") {
                  throw new Error("Hydrated Battle Profile is unavailable")
                }

                return event.output.state.head.profile
              },
              battleProfileStoreState: ({ event }) => {
                if (event.output.status !== "ready") {
                  throw new Error("Hydrated durable state is unavailable")
                }

                return event.output.state
              },
              persistenceIssue: null,
            }),
          },
          {
            guard: ({ event }) => event.output.status === "recovery-required",
            target: "PersistenceFailure",
            actions: assign({
              persistenceIssue: ({ event }) =>
                event.output.status === "recovery-required"
                  ? event.output.issue
                  : "Battle Profile recovery is required",
            }),
          },
          {
            guard: ({ context, event }) =>
              event.output.status === "empty" && context.uuid === null,
            target: "Splash",
          },
          { target: "InitializingProfile" },
        ],
        onError: {
          target: "PersistenceFailure",
          actions: assign({
            persistenceIssue: ({ event }) => getErrorMessage(event.error),
          }),
        },
      },
    },
    Splash: {
      on: {
        "INTRODUCTION.COMPLETED": {
          target: "InitializingProfile",
          actions: assign({
            uuid: ({ event }) => event.uuid,
            shouldSaveIntroductionId: true,
          }),
        },
      },
    },
    InitializingProfile: {
      invoke: {
        src: "initializeBattleProfile",
        input: ({ context }) => ({
          store: context.durableStore,
          profile: requireBattleProfile(context),
          createdAt: context.now(),
          appVersion: context.appVersion,
        }),
        onDone: {
          target: "Hub",
          actions: [
            assign({
              battleProfile: ({ event }) => event.output.head.profile,
              battleProfileStoreState: ({ event }) => event.output,
              persistenceIssue: null,
            }),
            "saveIntroductionId",
            assign({ shouldSaveIntroductionId: false }),
          ],
        },
        onError: [
          {
            guard: ({ event }) =>
              event.error instanceof DurableStoreConflictError,
            target: "LoadingProfile",
          },
          {
            target: "PersistenceFailure",
            actions: assign({
              persistenceIssue: ({ event }) => getErrorMessage(event.error),
            }),
          },
        ],
      },
    },
    Hub: {
      on: {
        "BATTLE.START_REQUESTED": { target: "Crucible" },
        "ALL_VALUES.OPEN_REQUESTED": { target: "AllValues" },
      },
    },
    AllValues: {
      on: {
        "ALL_VALUES.CLOSE_REQUESTED": { target: "Hub" },
      },
    },
    Crucible: {
      initial: "Ready",
      states: {
        Ready: {
          on: {
            "BATTLE.EXIT_REQUESTED": { target: "#root.Hub" },
            "BATTLE.WINNER_SELECTED": {
              guard: "isCurrentBattleSelection",
              target: "Persisting",
              actions: assign({
                pendingBattleProfileCommit: ({ context, event }) =>
                  createBattleChoiceCommit({
                    profile: requireBattleProfile(context),
                    winnerId: event.winnerId,
                    expectedScheduler: event.expectedScheduler,
                  }),
              }),
            },
            "BATTLE.UNDO_REQUESTED": {
              guard: "canUndoBattle",
              target: "Persisting",
              actions: assign({
                pendingBattleProfileCommit: ({ context }) => {
                  const commit = createBattleUndoCommit(
                    requireBattleProfile(context),
                  )
                  if (!commit) {
                    throw new Error("Battle Undo is unavailable")
                  }

                  return commit
                },
              }),
            },
            "BATTLE.REDO_REQUESTED": {
              guard: "canRedoBattle",
              target: "Persisting",
              actions: assign({
                pendingBattleProfileCommit: ({ context }) => {
                  const commit = createBattleRedoCommit(
                    requireBattleProfile(context),
                  )
                  if (!commit) {
                    throw new Error("Battle Redo is unavailable")
                  }

                  return commit
                },
              }),
            },
          },
        },
        Persisting: {
          invoke: {
            src: "commitBattleProfileEvent",
            input: ({ context }) => ({
              store: context.durableStore,
              state: requireBattleProfileStoreState(context),
              event: requirePendingBattleProfileCommit(context).event,
              committedAt: context.now(),
            }),
            onDone: {
              target: "Ready",
              actions: assign({
                battleProfile: ({ event }) => event.output.head.profile,
                battleProfileStoreState: ({ event }) => event.output,
                pendingBattleProfileCommit: null,
              }),
            },
            onError: {
              target: "#root.PersistenceFailure",
              actions: assign({
                pendingBattleProfileCommit: null,
                persistenceIssue: ({ event }) => getErrorMessage(event.error),
              }),
            },
          },
        },
      },
    },
    PersistenceFailure: {},
  },
})
