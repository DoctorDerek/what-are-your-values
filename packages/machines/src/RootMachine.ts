import type {
  CustomValueDefinition,
  CustomValueId,
  ValueId,
} from "@game/data/src/Value"
import { createCustomValueId } from "@game/data/src/Value"
import { assign, setup } from "xstate"
import { createInitialBattleProfile, type BattleProfile } from "./BattleProfile"
import {
  createBattleChoiceCommit,
  createBattleRedoCommit,
  createBattleUndoCommit,
  createDeckRevisionCommit,
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

type RootMachineContext = {
  readonly durableStore: DurableStoreAdapter
  readonly appVersion: string
  readonly now: () => string
  battleProfile: BattleProfile | null
  battleProfileStoreState: BattleProfileStoreState | null
  pendingBattleProfileCommit: BattleProfileCommit | null
  persistenceIssue: string | null
}

type RootMachineEvent =
  | {
      type: "APP.HYDRATED"
      schedulerSeed: string
    }
  | { type: "INTRODUCTION.COMPLETED" }
  | { type: "BATTLE.START_REQUESTED" }
  | { type: "ALL_VALUES.OPEN_REQUESTED" }
  | { type: "ALL_VALUES.CLOSE_REQUESTED" }
  | {
      type: "ALL_VALUES.ADD_REQUESTED"
      name: string
      definition: string
    }
  | {
      type: "ALL_VALUES.UPDATE_REQUESTED"
      valueId: CustomValueId
      name: string
      definition: string
    }
  | { type: "ALL_VALUES.DELETE_REQUESTED"; valueId: CustomValueId }
  | {
      type: "BATTLE.WINNER_SELECTED"
      winnerId: ValueId
      expectedScheduler: SchedulerRestorePoint
    }
  | { type: "BATTLE.UNDO_REQUESTED" }
  | { type: "BATTLE.REDO_REQUESTED" }
  | { type: "BATTLE.EXIT_REQUESTED" }

type RootMachineInput = {
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

function createNextCustomValue({
  existingCustomValues,
  name,
  definition,
  now,
}: {
  readonly existingCustomValues: readonly CustomValueDefinition[]
  readonly name: string
  readonly definition: string
  readonly now: () => string
}) {
  const trimmedName = name.trim()
  const trimmedDefinition = definition.trim()

  if (trimmedName.length === 0) {
    throw new Error("Custom Value name is required")
  }

  if (trimmedDefinition.length === 0) {
    throw new Error("Custom Value definition is required")
  }

  const nextCreationOrdinal =
    existingCustomValues.reduce(
      (maxOrdinal, value) =>
        value.creationOrdinal > maxOrdinal ? value.creationOrdinal : maxOrdinal,
      0,
    ) + 1

  return Object.freeze({
    kind: "custom",
    id: createCustomValueId(`custom:${crypto.randomUUID()}`),
    name: trimmedName,
    definition: trimmedDefinition,
    creationOrdinal: nextCreationOrdinal,
    createdAt: now(),
    updatedAt: now(),
  }) satisfies CustomValueDefinition
}

function createRevisedCustomValuesForAdd({
  profile,
  name,
  definition,
  now,
}: {
  readonly profile: BattleProfile
  readonly name: string
  readonly definition: string
  readonly now: () => string
}) {
  const customValues = Object.freeze([
    ...profile.activeDeck.customValues,
    createNextCustomValue({
      existingCustomValues: profile.activeDeck.customValues,
      name,
      definition,
      now,
    }),
  ])

  return customValues
}

function createRevisedCustomValuesForUpdate({
  profile,
  valueId,
  name,
  definition,
  now,
}: {
  readonly profile: BattleProfile
  readonly valueId: CustomValueId
  readonly name: string
  readonly definition: string
  readonly now: () => string
}) {
  const trimmedName = name.trim()
  const trimmedDefinition = definition.trim()

  if (trimmedName.length === 0) {
    throw new Error("Custom Value name is required")
  }

  if (trimmedDefinition.length === 0) {
    throw new Error("Custom Value definition is required")
  }

  return Object.freeze(
    profile.activeDeck.customValues.map((value) => {
      if (value.id !== valueId) {
        return value
      }

      return Object.freeze({
        ...value,
        name: trimmedName,
        definition: trimmedDefinition,
        updatedAt: now(),
      })
    }),
  )
}

function createRevisedCustomValuesForDelete({
  profile,
  valueId,
}: {
  readonly profile: BattleProfile
  readonly valueId: CustomValueId
}) {
  const revisedCustomValues = profile.activeDeck.customValues.filter(
    (value) => value.id !== valueId,
  )

  if (revisedCustomValues.length === profile.activeDeck.customValues.length) {
    throw new Error(`Custom Value does not exist: ${valueId}`)
  }

  return Object.freeze(revisedCustomValues)
}

function createDeckRevisionCommitFromUpdate({
  context,
  valueId,
  name,
  definition,
  now,
}: {
  readonly context: RootMachineContext
  readonly valueId: CustomValueId
  readonly name: string
  readonly definition: string
  readonly now: () => string
}) {
  const profile = requireBattleProfile(context)
  const revisedCustomValues = createRevisedCustomValuesForUpdate({
    profile,
    valueId,
    name,
    definition,
    now,
  })
  if (
    !revisedCustomValues.some((value) => value.id === valueId) ||
    profile.activeDeck.customValues.every((value) => value.id !== valueId)
  ) {
    throw new Error(`Custom Value does not exist: ${valueId}`)
  }

  return createDeckRevisionCommit({ profile, revisedCustomValues })
}

function createDeckRevisionCommitFromAdd({
  context,
  name,
  definition,
}: {
  readonly context: RootMachineContext
  readonly name: string
  readonly definition: string
}) {
  const profile = requireBattleProfile(context)
  const revisedCustomValues = createRevisedCustomValuesForAdd({
    profile,
    name,
    definition,
    now: context.now,
  })

  return createDeckRevisionCommit({ profile, revisedCustomValues })
}

function createDeckRevisionCommitFromDelete({
  context,
  valueId,
}: {
  readonly context: RootMachineContext
  readonly valueId: CustomValueId
}) {
  const profile = requireBattleProfile(context)
  const revisedCustomValues = createRevisedCustomValuesForDelete({
    profile,
    valueId,
  })

  return createDeckRevisionCommit({ profile, revisedCustomValues })
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
}).createMachine({
  id: "root",
  initial: "Hydrating",
  context: ({ input }) => ({
    battleProfile: null,
    battleProfileStoreState: null,
    pendingBattleProfileCommit: null,
    persistenceIssue: null,
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
            battleProfile: ({ event }) =>
              createInitialBattleProfile(event.schedulerSeed),
            persistenceIssue: null,
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
            guard: ({ event }) => event.output.status === "empty",
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
        "INTRODUCTION.COMPLETED": { target: "InitializingProfile" },
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
      initial: "Browsing",
      states: {
        Browsing: {
          on: {
            "ALL_VALUES.CLOSE_REQUESTED": { target: "#root.Hub" },
            "ALL_VALUES.ADD_REQUESTED": {
              target: "Persisting",
              actions: assign({
                pendingBattleProfileCommit: ({ context, event }) => {
                  if (event.type !== "ALL_VALUES.ADD_REQUESTED") {
                    throw new Error("Invalid add request event type")
                  }

                  return createDeckRevisionCommitFromAdd({
                    context,
                    name: event.name,
                    definition: event.definition,
                  })
                },
              }),
            },
            "ALL_VALUES.UPDATE_REQUESTED": {
              target: "Persisting",
              actions: assign({
                pendingBattleProfileCommit: ({ context, event }) => {
                  if (event.type !== "ALL_VALUES.UPDATE_REQUESTED") {
                    throw new Error("Invalid update request event type")
                  }

                  return createDeckRevisionCommitFromUpdate({
                    context,
                    valueId: event.valueId,
                    name: event.name,
                    definition: event.definition,
                    now: context.now,
                  })
                },
              }),
            },
            "ALL_VALUES.DELETE_REQUESTED": {
              target: "Persisting",
              actions: assign({
                pendingBattleProfileCommit: ({ context, event }) => {
                  if (event.type !== "ALL_VALUES.DELETE_REQUESTED") {
                    throw new Error("Invalid delete request event type")
                  }

                  return createDeckRevisionCommitFromDelete({
                    context,
                    valueId: event.valueId,
                  })
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
              target: "Browsing",
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
