import type { CustomValueId, ValueId } from "@game/data/src/Value"
import { getErrorMessage } from "@game/utils/src/Errors"
import { assign, setup } from "xstate"
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
  projectBattlePair,
  type BattleSchedulerRestorePoint,
} from "./BattleScheduler"
import {
  createCustomValueAddCommit,
  createCustomValueDeleteCommit,
  createCustomValueUpdateCommit,
} from "./CustomValueCommands"
import {
  DurableStoreConflictError,
  type DurableStoreAdapter,
} from "./DurableStoreAdapter"
import { createInitialPlayerData, type PlayerData } from "./PlayerData"
import {
  createWayvmExportActor,
  prepareWayvmImportActor,
  replacePlayerDataActor,
  type PreparedWayvmDownload,
} from "./PlayerDataPortabilityActors"
import {
  DELETE_ALL_DATA_ACKNOWLEDGMENT,
  type PlayerDataResetKind,
  type ScopedPlayerDataResetKind,
} from "./PlayerDataReset"
import {
  applyScopedPlayerDataResetActor,
  deleteAllPlayerDataActor,
} from "./PlayerDataResetActors"
import { areSchedulerIdentitiesEqual } from "./SchedulerIdentity"
import type { PreparedWayvmImport } from "./WayvmImportPreview"

type PendingResetReview = {
  readonly resetKind: PlayerDataResetKind
  readonly confirmationId: string
}

type RootMachineContext = {
  readonly durableStore: DurableStoreAdapter
  readonly appVersion: string
  readonly sourceBuild: string
  readonly now: () => string
  readonly randomUuid: () => string
  playerData: PlayerData | null
  battleProfileStoreState: BattleProfileStoreState | null
  pendingBattleProfileCommit: BattleProfileCommit | null
  pendingImportBytes: string | null
  pendingImport: PreparedWayvmImport | null
  preImportBackupBytes: string | null
  preparedDownload: PreparedWayvmDownload | null
  pendingResetReview: PendingResetReview | null
  persistenceIssue: string | null
  portabilityIssue: string | null
  portabilityNotice: string | null
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
      expectedScheduler: BattleSchedulerRestorePoint
    }
  | { type: "BATTLE.UNDO_REQUESTED" }
  | { type: "BATTLE.REDO_REQUESTED" }
  | { type: "BATTLE.EXIT_REQUESTED" }
  | { type: "DATA_MANAGEMENT.OPEN_REQUESTED" }
  | { type: "DATA_MANAGEMENT.CLOSE_REQUESTED" }
  | { type: "DATA_MANAGEMENT.EXPORT_REQUESTED" }
  | { type: "DATA_MANAGEMENT.EXPORT_CONSUMED" }
  | {
      type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED"
      serialized: string
    }
  | { type: "DATA_MANAGEMENT.IMPORT_CANCEL_REQUESTED" }
  | { type: "DATA_MANAGEMENT.IMPORT_CONFIRM_REQUESTED" }
  | { type: "CUSTOM_VALUE.DELETE_ALL_REQUESTED" }
  | {
      type: "CUSTOM_VALUE.DELETE_ALL_CONFIRMED"
      confirmationId: string
    }
  | { type: "RESET.LEVELS_AND_EXPERIENCE_REQUESTED" }
  | {
      type: "RESET.LEVELS_AND_EXPERIENCE_CONFIRMED"
      confirmationId: string
    }
  | { type: "RESET.ACHIEVEMENTS_REQUESTED" }
  | { type: "RESET.ACHIEVEMENTS_CONFIRMED"; confirmationId: string }
  | { type: "DELETE_ALL_DATA.REQUESTED" }
  | { type: "DELETE_ALL_DATA.CONFIRMED"; phrase: string }
  | { type: "DATA_MANAGEMENT.RESET_CANCEL_REQUESTED" }

type RootMachineInput = {
  readonly durableStore: DurableStoreAdapter
  readonly appVersion: string
  readonly sourceBuild: string
  readonly now: () => string
  readonly randomUuid: () => string
}

function requirePlayerData(context: RootMachineContext) {
  if (!context.playerData) {
    throw new Error("Player data is not initialized")
  }

  return context.playerData
}

function requireBattleProfile(context: RootMachineContext) {
  return requirePlayerData(context).profile
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

function requirePendingImportBytes(context: RootMachineContext) {
  if (context.pendingImportBytes === null) {
    throw new Error("Import bytes are not prepared")
  }

  return context.pendingImportBytes
}

function requirePendingImport(context: RootMachineContext) {
  if (!context.pendingImport) {
    throw new Error("Validated import data is not prepared")
  }

  return context.pendingImport
}

function requirePreImportBackupBytes(context: RootMachineContext) {
  if (!context.preImportBackupBytes) {
    throw new Error("Pre-import backup bytes are not prepared")
  }

  return context.preImportBackupBytes
}

function createPendingResetReview(
  context: RootMachineContext,
  resetKind: PlayerDataResetKind,
) {
  const confirmationId = context.randomUuid()
  if (confirmationId.length === 0) {
    throw new Error("Reset confirmation ID is required")
  }

  return Object.freeze({ resetKind, confirmationId })
}

function requirePendingResetReview(context: RootMachineContext) {
  if (!context.pendingResetReview) {
    throw new Error("Reset review is not prepared")
  }

  return context.pendingResetReview
}

function requirePendingScopedResetKind(
  context: RootMachineContext,
): ScopedPlayerDataResetKind {
  const { resetKind } = requirePendingResetReview(context)
  if (resetKind === "delete-all-data") {
    throw new Error("Complete data erasure is not a scoped reset")
  }

  return resetKind
}

function isMatchingScopedResetConfirmation({
  context,
  confirmationId,
  resetKind,
}: {
  readonly context: RootMachineContext
  readonly confirmationId: string
  readonly resetKind: ScopedPlayerDataResetKind
}) {
  return (
    context.pendingResetReview?.resetKind === resetKind &&
    context.pendingResetReview.confirmationId === confirmationId
  )
}

function getResetSuccessNotice(resetKind: ScopedPlayerDataResetKind) {
  if (resetKind === "delete-all-custom-values") {
    return "All Custom Values were deleted. Canonical value progress, achievements, and settings were kept."
  }
  if (resetKind === "reset-levels-and-experience") {
    return "Levels and experience were reset. Custom Values, achievements, and settings were kept."
  }

  return "Achievements and achievement progress were reset. Your values, ranking, and settings were kept."
}

function createFreshPlayerDataAfterDeletion(context: RootMachineContext) {
  const createdAt = context.now()
  return createInitialPlayerData({
    schedulerSeed: `delete-all:${createdAt}`,
    createdAt,
  })
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
    createWayvmExport: createWayvmExportActor,
    prepareWayvmImport: prepareWayvmImportActor,
    replacePlayerData: replacePlayerDataActor,
    applyScopedPlayerDataReset: applyScopedPlayerDataResetActor,
    deleteAllPlayerData: deleteAllPlayerDataActor,
  },
  guards: {
    isCurrentBattleSelection: ({ context, event }) => {
      if (event.type !== "BATTLE.WINNER_SELECTED" || !context.playerData) {
        return false
      }

      if (
        !areSchedulerIdentitiesEqual(
          context.playerData.profile.scheduler,
          event.expectedScheduler,
        )
      ) {
        return false
      }

      return projectBattlePair(
        context.playerData.profile.activeDeck,
        context.playerData.profile.scheduler,
      ).includes(event.winnerId)
    },
    canUndoBattle: ({ context }) =>
      requireBattleProfile(context).history.length > 0,
    canRedoBattle: ({ context }) =>
      requireBattleProfile(context).redo.length > 0,
    canConfirmDeleteAllCustomValues: ({ context, event }) =>
      event.type === "CUSTOM_VALUE.DELETE_ALL_CONFIRMED" &&
      isMatchingScopedResetConfirmation({
        context,
        confirmationId: event.confirmationId,
        resetKind: "delete-all-custom-values",
      }),
    canConfirmLevelsAndExperienceReset: ({ context, event }) =>
      event.type === "RESET.LEVELS_AND_EXPERIENCE_CONFIRMED" &&
      isMatchingScopedResetConfirmation({
        context,
        confirmationId: event.confirmationId,
        resetKind: "reset-levels-and-experience",
      }),
    canConfirmAchievementsReset: ({ context, event }) =>
      event.type === "RESET.ACHIEVEMENTS_CONFIRMED" &&
      isMatchingScopedResetConfirmation({
        context,
        confirmationId: event.confirmationId,
        resetKind: "reset-achievements",
      }),
    canConfirmDeleteAllData: ({ context, event }) =>
      event.type === "DELETE_ALL_DATA.CONFIRMED" &&
      context.pendingResetReview?.resetKind === "delete-all-data" &&
      event.phrase === DELETE_ALL_DATA_ACKNOWLEDGMENT,
  },
}).createMachine({
  id: "root",
  initial: "Hydrating",
  context: ({ input }) => ({
    playerData: null,
    battleProfileStoreState: null,
    pendingBattleProfileCommit: null,
    pendingImportBytes: null,
    pendingImport: null,
    preImportBackupBytes: null,
    preparedDownload: null,
    pendingResetReview: null,
    persistenceIssue: null,
    portabilityIssue: null,
    portabilityNotice: null,
    durableStore: input.durableStore,
    appVersion: input.appVersion,
    sourceBuild: input.sourceBuild,
    now: input.now,
    randomUuid: input.randomUuid,
  }),
  states: {
    Hydrating: {
      on: {
        "APP.HYDRATED": {
          target: "LoadingProfile",
          actions: assign({
            playerData: ({ context, event }) =>
              createInitialPlayerData({
                schedulerSeed: event.schedulerSeed,
                createdAt: context.now(),
              }),
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
              playerData: ({ event }) => {
                if (event.output.status !== "ready") {
                  throw new Error("Hydrated Battle Profile is unavailable")
                }

                return event.output.state.head.playerData
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
          playerData: requirePlayerData(context),
          createdAt: context.now(),
          appVersion: context.appVersion,
        }),
        onDone: {
          target: "Hub",
          actions: [
            assign({
              playerData: ({ event }) => event.output.head.playerData,
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
        "DATA_MANAGEMENT.OPEN_REQUESTED": { target: "DataManagement" },
      },
    },
    DataManagement: {
      initial: "Browsing",
      states: {
        Browsing: {
          on: {
            "DATA_MANAGEMENT.CLOSE_REQUESTED": {
              target: "#root.Hub",
              actions: assign({
                pendingImport: null,
                pendingImportBytes: null,
                preImportBackupBytes: null,
                pendingResetReview: null,
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "DATA_MANAGEMENT.EXPORT_REQUESTED": {
              target: "Exporting",
              actions: assign({
                preparedDownload: null,
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "DATA_MANAGEMENT.EXPORT_CONSUMED": {
              actions: assign({ preparedDownload: null }),
            },
            "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED": {
              target: "PreparingImport",
              actions: assign({
                pendingImportBytes: ({ event }) => event.serialized,
                pendingImport: null,
                preImportBackupBytes: null,
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "CUSTOM_VALUE.DELETE_ALL_REQUESTED": {
              target: "ReviewingReset",
              actions: assign({
                preparedDownload: null,
                pendingResetReview: ({ context }) =>
                  createPendingResetReview(context, "delete-all-custom-values"),
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "RESET.LEVELS_AND_EXPERIENCE_REQUESTED": {
              target: "ReviewingReset",
              actions: assign({
                preparedDownload: null,
                pendingResetReview: ({ context }) =>
                  createPendingResetReview(
                    context,
                    "reset-levels-and-experience",
                  ),
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "RESET.ACHIEVEMENTS_REQUESTED": {
              target: "ReviewingReset",
              actions: assign({
                preparedDownload: null,
                pendingResetReview: ({ context }) =>
                  createPendingResetReview(context, "reset-achievements"),
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "DELETE_ALL_DATA.REQUESTED": {
              target: "ReviewingReset",
              actions: assign({
                preparedDownload: null,
                pendingResetReview: ({ context }) =>
                  createPendingResetReview(context, "delete-all-data"),
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
          },
        },
        Exporting: {
          invoke: {
            src: "createWayvmExport",
            input: ({ context }) => ({
              exportedAt: context.now(),
              sourceAppVersion: context.appVersion,
              sourceBuild: context.sourceBuild,
              playerData: requirePlayerData(context),
            }),
            onDone: {
              target: "Browsing",
              actions: assign({
                preparedDownload: ({ event }) => event.output,
                portabilityIssue: null,
                portabilityNotice: "Your private backup is ready.",
              }),
            },
            onError: {
              target: "Browsing",
              actions: assign({
                preparedDownload: null,
                portabilityIssue: ({ event }) => getErrorMessage(event.error),
                portabilityNotice: null,
              }),
            },
          },
        },
        PreparingImport: {
          invoke: {
            src: "prepareWayvmImport",
            input: ({ context }) => ({
              serialized: requirePendingImportBytes(context),
            }),
            onDone: {
              target: "ReviewingImport",
              actions: assign({
                pendingImportBytes: null,
                pendingImport: ({ event }) => event.output,
                portabilityIssue: null,
              }),
            },
            onError: {
              target: "Browsing",
              actions: assign({
                pendingImportBytes: null,
                pendingImport: null,
                portabilityIssue: ({ event }) => getErrorMessage(event.error),
              }),
            },
          },
        },
        ReviewingImport: {
          on: {
            "DATA_MANAGEMENT.CLOSE_REQUESTED": {
              target: "#root.Hub",
              actions: assign({
                pendingImport: null,
                preImportBackupBytes: null,
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "DATA_MANAGEMENT.IMPORT_CANCEL_REQUESTED": {
              target: "Browsing",
              actions: assign({
                pendingImport: null,
                preImportBackupBytes: null,
                portabilityIssue: null,
              }),
            },
            "DATA_MANAGEMENT.IMPORT_CONFIRM_REQUESTED": {
              target: "CreatingPreImportBackup",
              actions: assign({
                preImportBackupBytes: null,
                portabilityIssue: null,
              }),
            },
          },
        },
        ReviewingReset: {
          on: {
            "DATA_MANAGEMENT.CLOSE_REQUESTED": {
              target: "#root.Hub",
              actions: assign({
                pendingResetReview: null,
                preparedDownload: null,
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "DATA_MANAGEMENT.RESET_CANCEL_REQUESTED": {
              target: "Browsing",
              actions: assign({
                pendingResetReview: null,
                preparedDownload: null,
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "DATA_MANAGEMENT.EXPORT_REQUESTED": {
              target: "ExportingResetBackup",
              actions: assign({
                preparedDownload: null,
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "DATA_MANAGEMENT.EXPORT_CONSUMED": {
              actions: assign({ preparedDownload: null }),
            },
            "CUSTOM_VALUE.DELETE_ALL_CONFIRMED": {
              guard: "canConfirmDeleteAllCustomValues",
              target: "ApplyingScopedReset",
              actions: assign({
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "RESET.LEVELS_AND_EXPERIENCE_CONFIRMED": {
              guard: "canConfirmLevelsAndExperienceReset",
              target: "ApplyingScopedReset",
              actions: assign({
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "RESET.ACHIEVEMENTS_CONFIRMED": {
              guard: "canConfirmAchievementsReset",
              target: "ApplyingScopedReset",
              actions: assign({
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "DELETE_ALL_DATA.CONFIRMED": {
              guard: "canConfirmDeleteAllData",
              target: "DeletingAllData",
              actions: assign({
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
          },
        },
        ExportingResetBackup: {
          invoke: {
            src: "createWayvmExport",
            input: ({ context }) => ({
              exportedAt: context.now(),
              sourceAppVersion: context.appVersion,
              sourceBuild: context.sourceBuild,
              playerData: requirePlayerData(context),
            }),
            onDone: {
              target: "ReviewingReset",
              actions: assign({
                preparedDownload: ({ event }) => event.output,
                portabilityIssue: null,
                portabilityNotice:
                  "Your private backup is ready. Review the reset when you are ready.",
              }),
            },
            onError: {
              target: "ReviewingReset",
              actions: assign({
                preparedDownload: null,
                portabilityIssue: ({ event }) => getErrorMessage(event.error),
                portabilityNotice: null,
              }),
            },
          },
        },
        ApplyingScopedReset: {
          invoke: {
            src: "applyScopedPlayerDataReset",
            input: ({ context }) => ({
              store: context.durableStore,
              state: requireBattleProfileStoreState(context),
              resetKind: requirePendingScopedResetKind(context),
              resetAt: context.now(),
            }),
            onDone: {
              target: "Browsing",
              actions: assign({
                playerData: ({ event }) => event.output.head.playerData,
                battleProfileStoreState: ({ event }) => event.output,
                portabilityNotice: ({ context }) =>
                  getResetSuccessNotice(requirePendingScopedResetKind(context)),
                pendingResetReview: null,
                preparedDownload: null,
                portabilityIssue: null,
              }),
            },
            onError: {
              target: "ReviewingReset",
              actions: assign({
                portabilityIssue: ({ event }) => getErrorMessage(event.error),
              }),
            },
          },
        },
        DeletingAllData: {
          invoke: {
            src: "deleteAllPlayerData",
            input: ({ context }) => ({
              store: context.durableStore,
              state: requireBattleProfileStoreState(context),
            }),
            onDone: {
              target: "#root.Splash",
              actions: assign({
                playerData: ({ context }) =>
                  createFreshPlayerDataAfterDeletion(context),
                battleProfileStoreState: null,
                pendingBattleProfileCommit: null,
                pendingResetReview: null,
                pendingImport: null,
                pendingImportBytes: null,
                preImportBackupBytes: null,
                preparedDownload: null,
                persistenceIssue: null,
                portabilityIssue: null,
                portabilityNotice: "All local WAYVM player data was deleted.",
              }),
            },
            onError: {
              target: "ReviewingReset",
              actions: assign({
                portabilityIssue: ({ event }) => getErrorMessage(event.error),
              }),
            },
          },
        },
        CreatingPreImportBackup: {
          invoke: {
            src: "createWayvmExport",
            input: ({ context }) => ({
              exportedAt: context.now(),
              sourceAppVersion: context.appVersion,
              sourceBuild: context.sourceBuild,
              playerData: requirePlayerData(context),
            }),
            onDone: {
              target: "ReplacingImport",
              actions: assign({
                preImportBackupBytes: ({ event }) => event.output.serialized,
              }),
            },
            onError: {
              target: "ReviewingImport",
              actions: assign({
                preImportBackupBytes: null,
                portabilityIssue: ({ event }) => getErrorMessage(event.error),
              }),
            },
          },
        },
        ReplacingImport: {
          invoke: {
            src: "replacePlayerData",
            input: ({ context }) => ({
              store: context.durableStore,
              state: requireBattleProfileStoreState(context),
              playerData: requirePendingImport(context).wayvmExport.playerData,
              preImportBackupBytes: requirePreImportBackupBytes(context),
              replacedAt: context.now(),
            }),
            onDone: {
              target: "Browsing",
              actions: assign({
                playerData: ({ event }) => event.output.head.playerData,
                battleProfileStoreState: ({ event }) => event.output,
                pendingImport: null,
                preImportBackupBytes: null,
                portabilityIssue: null,
                portabilityNotice:
                  "Your imported values and progress are now active.",
              }),
            },
            onError: {
              target: "ReviewingImport",
              actions: assign({
                preImportBackupBytes: null,
                portabilityIssue: ({ event }) => getErrorMessage(event.error),
              }),
            },
          },
        },
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
                persistenceIssue: null,
                pendingBattleProfileCommit: ({ context, event }) => {
                  if (event.type !== "ALL_VALUES.ADD_REQUESTED") {
                    throw new Error("Invalid add request event type")
                  }

                  return createCustomValueAddCommit({
                    profile: requireBattleProfile(context),
                    name: event.name,
                    definition: event.definition,
                    now: context.now,
                    randomUuid: context.randomUuid,
                  })
                },
              }),
            },
            "ALL_VALUES.UPDATE_REQUESTED": {
              target: "Persisting",
              actions: assign({
                persistenceIssue: null,
                pendingBattleProfileCommit: ({ context, event }) => {
                  if (event.type !== "ALL_VALUES.UPDATE_REQUESTED") {
                    throw new Error("Invalid update request event type")
                  }

                  return createCustomValueUpdateCommit({
                    profile: requireBattleProfile(context),
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
                persistenceIssue: null,
                pendingBattleProfileCommit: ({ context, event }) => {
                  if (event.type !== "ALL_VALUES.DELETE_REQUESTED") {
                    throw new Error("Invalid delete request event type")
                  }

                  return createCustomValueDeleteCommit({
                    profile: requireBattleProfile(context),
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
                playerData: ({ event }) => event.output.head.playerData,
                battleProfileStoreState: ({ event }) => event.output,
                pendingBattleProfileCommit: null,
                persistenceIssue: null,
              }),
            },
            onError: {
              target: "Browsing",
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
                playerData: ({ event }) => event.output.head.playerData,
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
