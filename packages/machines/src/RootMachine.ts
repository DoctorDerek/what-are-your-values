import type { CustomValueId, ValueId } from "@game/data/src/Value"
import { getErrorMessage } from "@game/utils/src/Errors"
import { assign, setup } from "xstate"
import type { AchievementId } from "./AchievementCatalog"
import { recordAchievementPresentationActor } from "./AchievementPresentationActors"
import { getPendingAchievementUnlocks } from "./AchievementState"
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
import {
  createRecoveryBundleActor,
  deleteUnrecoverablePlayerDataActor,
  replaceUnrecoverablePlayerDataActor,
} from "./BattleProfileRecoveryActors"
import {
  BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
  type BattleProfileStoreState,
} from "./BattleProfileStore"
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
  getWayvmImportValidationIssue,
  playerDataPortabilityCopy,
} from "./PlayerDataPortabilityCopy"
import { playerDataRecoveryCopy } from "./PlayerDataRecoveryCopy"
import {
  DELETE_ALL_DATA_ACKNOWLEDGMENT,
  type PlayerDataResetKind,
  type PlayerDataResetReview,
  type ScopedPlayerDataResetKind,
} from "./PlayerDataReset"
import {
  applyScopedPlayerDataResetActor,
  deleteAllPlayerDataActor,
} from "./PlayerDataResetActors"
import {
  playerDataResetBackupReadyNotice,
  playerDataResetCopy,
} from "./PlayerDataResetCopy"
import { areSchedulerIdentitiesEqual } from "./SchedulerIdentity"
import type { PreparedWayvmImport } from "./WayvmImportPreview"

type PendingRecoveryImportSource = "last-known-good" | "selected-backup"

type AchievementPresentationReturnTarget = "hub" | "achievements" | "crucible"

type PersistenceFailureOrigin =
  "loading" | "initialization" | "crucible" | "achievement-presentation"

type RootMachineContext = {
  readonly durableStore: DurableStoreAdapter
  readonly appVersion: string
  readonly sourceBuild: string
  readonly now: () => string
  readonly randomUuid: () => string
  playerData: PlayerData | null
  battleProfileStoreState: BattleProfileStoreState | null
  pendingBattleProfileCommit: BattleProfileCommit | null
  pendingAchievementPresentationId: AchievementId | null
  achievementPresentationReturnTarget: AchievementPresentationReturnTarget | null
  pendingImportBytes: string | null
  pendingImport: PreparedWayvmImport | null
  preImportBackupBytes: string | null
  preparedDownload: PreparedWayvmDownload | null
  pendingResetReview: PlayerDataResetReview | null
  recoveryEntries: ReadonlyMap<string, string> | null
  pendingRecoveryImportSource: PendingRecoveryImportSource | null
  persistenceFailureOrigin: PersistenceFailureOrigin | null
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
  | { type: "ACHIEVEMENTS.OPEN_REQUESTED" }
  | { type: "ACHIEVEMENTS.CLOSE_REQUESTED" }
  | { type: "ACHIEVEMENT.PRESENTED"; achievementId: AchievementId }
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
  | { type: "DATA_MANAGEMENT.IMPORT_FILE_READ_REQUESTED" }
  | { type: "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED"; issue: string }
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
  | {
      type: "DELETE_ALL_DATA.CONFIRMED"
      confirmationId: string
      phrase: string
    }
  | { type: "DATA_MANAGEMENT.RESET_CANCEL_REQUESTED" }
  | { type: "RECOVERY.EXPORT_REQUESTED" }
  | { type: "RECOVERY.EXPORT_CONSUMED" }
  | {
      type: "RECOVERY.IMPORT_PREPARE_REQUESTED"
      serialized: string
    }
  | { type: "RECOVERY.RESTORE_BACKUP_REQUESTED" }
  | { type: "RECOVERY.IMPORT_CANCEL_REQUESTED" }
  | { type: "RECOVERY.IMPORT_CONFIRM_REQUESTED" }
  | { type: "RECOVERY.DELETE_ALL_REQUESTED" }
  | {
      type: "RECOVERY.DELETE_ALL_CONFIRMED"
      confirmationId: string
      phrase: string
    }
  | { type: "RECOVERY.DELETE_ALL_CANCEL_REQUESTED" }
  | { type: "RECOVERY.PLATFORM_FAILURE_REPORTED"; issue: string }
  | { type: "STORAGE_RECOVERY.EXPORT_REQUESTED" }
  | { type: "STORAGE_RECOVERY.RETRY_REQUESTED" }
  | { type: "STORAGE_RECOVERY.RETURN_REQUESTED" }

type RootMachineInput = {
  readonly durableStore: DurableStoreAdapter
  readonly appVersion: string
  readonly sourceBuild: string
  readonly now: () => string
  readonly randomUuid: () => string
}

const CLEARED_ACHIEVEMENT_PRESENTATION_CONTEXT = Object.freeze({
  pendingAchievementPresentationId: null,
  achievementPresentationReturnTarget: null,
  persistenceFailureOrigin: null,
  persistenceIssue: null,
} as const)

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

function requirePendingAchievementPresentationId(context: RootMachineContext) {
  if (!context.pendingAchievementPresentationId) {
    throw new Error("Achievement presentation is not prepared")
  }

  return context.pendingAchievementPresentationId
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

function isMatchingResetConfirmation({
  context,
  confirmationId,
  resetKind,
}: {
  readonly context: RootMachineContext
  readonly confirmationId: string
  readonly resetKind: PlayerDataResetKind
}) {
  return (
    context.pendingResetReview?.resetKind === resetKind &&
    context.pendingResetReview.confirmationId === confirmationId
  )
}

function createFreshPlayerDataAfterDeletion(context: RootMachineContext) {
  const createdAt = context.now()
  return createInitialPlayerData({
    schedulerSeed: `delete-all:${createdAt}`,
    createdAt,
  })
}

function requireRecoveryEntries(context: RootMachineContext) {
  if (!context.recoveryEntries) {
    throw new Error("Captured recovery entries are unavailable")
  }

  return context.recoveryEntries
}

function requireStoredRecoveryBackup(context: RootMachineContext) {
  const backup = requireRecoveryEntries(context).get(
    BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
  )
  if (backup === undefined) {
    throw new Error("A stored recovery backup is unavailable")
  }

  return backup
}

function getRecoveryReplacementNotice(context: RootMachineContext) {
  return context.pendingRecoveryImportSource === "last-known-good"
    ? playerDataRecoveryCopy.unreadableData.restoreSuccess
    : playerDataRecoveryCopy.unreadableData.selectedBackupSuccess
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
    recordAchievementPresentation: recordAchievementPresentationActor,
    createWayvmExport: createWayvmExportActor,
    prepareWayvmImport: prepareWayvmImportActor,
    replacePlayerData: replacePlayerDataActor,
    applyScopedPlayerDataReset: applyScopedPlayerDataResetActor,
    deleteAllPlayerData: deleteAllPlayerDataActor,
    createRecoveryBundle: createRecoveryBundleActor,
    replaceUnrecoverablePlayerData: replaceUnrecoverablePlayerDataActor,
    deleteUnrecoverablePlayerData: deleteUnrecoverablePlayerDataActor,
  },
  actions: {
    clearPortabilityFeedback: assign({
      portabilityIssue: null,
      portabilityNotice: null,
    }),
    reportDataManagementPlatformFailure: assign({
      preparedDownload: null,
      portabilityIssue: ({ event }) =>
        event.type === "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED"
          ? event.issue
          : null,
      portabilityNotice: null,
    }),
    reportRecoveryPlatformFailure: assign({
      preparedDownload: null,
      portabilityIssue: ({ event }) =>
        event.type === "RECOVERY.PLATFORM_FAILURE_REPORTED"
          ? event.issue
          : null,
      portabilityNotice: null,
    }),
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
      isMatchingResetConfirmation({
        context,
        confirmationId: event.confirmationId,
        resetKind: "delete-all-custom-values",
      }),
    canConfirmLevelsAndExperienceReset: ({ context, event }) =>
      event.type === "RESET.LEVELS_AND_EXPERIENCE_CONFIRMED" &&
      isMatchingResetConfirmation({
        context,
        confirmationId: event.confirmationId,
        resetKind: "reset-levels-and-experience",
      }),
    canConfirmAchievementsReset: ({ context, event }) =>
      event.type === "RESET.ACHIEVEMENTS_CONFIRMED" &&
      isMatchingResetConfirmation({
        context,
        confirmationId: event.confirmationId,
        resetKind: "reset-achievements",
      }),
    canConfirmDeleteAllData: ({ context, event }) =>
      event.type === "DELETE_ALL_DATA.CONFIRMED" &&
      isMatchingResetConfirmation({
        context,
        confirmationId: event.confirmationId,
        resetKind: "delete-all-data",
      }) &&
      event.phrase === DELETE_ALL_DATA_ACKNOWLEDGMENT,
    hasRecoveryEntries: ({ context }) => context.recoveryEntries !== null,
    hasStoredRecoveryBackup: ({ context }) =>
      context.recoveryEntries?.has(BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY) ??
      false,
    canConfirmRecoveryDeletion: ({ context, event }) =>
      context.recoveryEntries !== null &&
      event.type === "RECOVERY.DELETE_ALL_CONFIRMED" &&
      isMatchingResetConfirmation({
        context,
        confirmationId: event.confirmationId,
        resetKind: "delete-all-data",
      }) &&
      event.phrase === DELETE_ALL_DATA_ACKNOWLEDGMENT,
    hasPendingResetReview: ({ context }) => context.pendingResetReview !== null,
    canExportCurrentDataAfterStorageFailure: ({ context }) =>
      context.playerData !== null &&
      context.persistenceFailureOrigin !== null &&
      context.persistenceFailureOrigin !== "loading",
    isLoadingStorageFailure: ({ context }) =>
      context.persistenceFailureOrigin === "loading",
    isInitializationStorageFailure: ({ context }) =>
      context.persistenceFailureOrigin === "initialization",
    isCrucibleStorageFailure: ({ context }) =>
      context.persistenceFailureOrigin === "crucible",
    isAchievementPresentationStorageFailure: ({ context }) =>
      context.persistenceFailureOrigin === "achievement-presentation",
    canRecordAchievementPresentation: ({ context, event }) =>
      event.type === "ACHIEVEMENT.PRESENTED" &&
      context.battleProfileStoreState !== null &&
      context.playerData !== null &&
      getPendingAchievementUnlocks(context.playerData.achievements)[0]?.id ===
        event.achievementId,
    hasPendingAchievementPresentation: ({ context }) =>
      context.pendingAchievementPresentationId !== null,
    shouldReturnAchievementPresentationToAchievements: ({ context }) =>
      context.achievementPresentationReturnTarget === "achievements",
    shouldReturnAchievementPresentationToCrucible: ({ context }) =>
      context.achievementPresentationReturnTarget === "crucible",
    shouldReturnFailedAchievementPresentationToAchievements: ({ context }) =>
      context.persistenceFailureOrigin === "achievement-presentation" &&
      context.achievementPresentationReturnTarget === "achievements",
    shouldReturnFailedAchievementPresentationToCrucible: ({ context }) =>
      context.persistenceFailureOrigin === "achievement-presentation" &&
      context.achievementPresentationReturnTarget === "crucible",
    shouldReturnFailedAchievementPresentationToHub: ({ context }) =>
      context.persistenceFailureOrigin === "achievement-presentation" &&
      context.achievementPresentationReturnTarget === "hub",
  },
}).createMachine({
  id: "root",
  initial: "Hydrating",
  context: ({ input }) => ({
    playerData: null,
    battleProfileStoreState: null,
    pendingBattleProfileCommit: null,
    pendingAchievementPresentationId: null,
    achievementPresentationReturnTarget: null,
    pendingImportBytes: null,
    pendingImport: null,
    preImportBackupBytes: null,
    preparedDownload: null,
    pendingResetReview: null,
    recoveryEntries: null,
    pendingRecoveryImportSource: null,
    persistenceFailureOrigin: null,
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
              recoveryEntries: null,
              pendingRecoveryImportSource: null,
              persistenceFailureOrigin: null,
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
              recoveryEntries: ({ event }) =>
                event.output.status === "recovery-required"
                  ? event.output.entries
                  : null,
              pendingRecoveryImportSource: null,
              persistenceFailureOrigin: null,
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
            pendingRecoveryImportSource: null,
            persistenceFailureOrigin: "loading",
            persistenceIssue: ({ event }) => getErrorMessage(event.error),
          }),
        },
      },
    },
    Splash: {
      on: {
        "INTRODUCTION.COMPLETED": {
          target: "InitializingProfile",
          actions: "clearPortabilityFeedback",
        },
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
              recoveryEntries: null,
              pendingRecoveryImportSource: null,
              persistenceFailureOrigin: null,
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
              recoveryEntries: null,
              pendingRecoveryImportSource: null,
              persistenceFailureOrigin: "initialization",
              persistenceIssue: ({ event }) => getErrorMessage(event.error),
            }),
          },
        ],
      },
    },
    Hub: {
      on: {
        "BATTLE.START_REQUESTED": {
          target: "Crucible",
          actions: "clearPortabilityFeedback",
        },
        "ACHIEVEMENTS.OPEN_REQUESTED": {
          target: "Achievements",
          actions: "clearPortabilityFeedback",
        },
        "ACHIEVEMENT.PRESENTED": {
          guard: "canRecordAchievementPresentation",
          target: "RecordingAchievementPresentation",
          actions: assign({
            pendingAchievementPresentationId: ({ event }) =>
              event.achievementId,
            achievementPresentationReturnTarget: "hub",
          }),
        },
        "ALL_VALUES.OPEN_REQUESTED": {
          target: "AllValues",
          actions: "clearPortabilityFeedback",
        },
        "DATA_MANAGEMENT.OPEN_REQUESTED": {
          target: "DataManagement",
          actions: "clearPortabilityFeedback",
        },
      },
    },
    Achievements: {
      on: {
        "ACHIEVEMENTS.CLOSE_REQUESTED": { target: "Hub" },
        "ACHIEVEMENT.PRESENTED": {
          guard: "canRecordAchievementPresentation",
          target: "RecordingAchievementPresentation",
          actions: assign({
            pendingAchievementPresentationId: ({ event }) =>
              event.achievementId,
            achievementPresentationReturnTarget: "achievements",
          }),
        },
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
            "DATA_MANAGEMENT.IMPORT_FILE_READ_REQUESTED": {
              actions: "clearPortabilityFeedback",
            },
            "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED": {
              actions: "reportDataManagementPlatformFailure",
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
                portabilityNotice: playerDataPortabilityCopy.exportSuccess,
              }),
            },
            onError: {
              target: "Browsing",
              actions: assign({
                preparedDownload: null,
                portabilityIssue: playerDataPortabilityCopy.exportFailure,
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
                portabilityIssue: ({ event }) =>
                  getWayvmImportValidationIssue(event.error),
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
                portabilityNotice: playerDataPortabilityCopy.importCancelled,
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
            "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED": {
              actions: "reportDataManagementPlatformFailure",
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
                portabilityNotice: playerDataResetBackupReadyNotice,
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
                  playerDataResetCopy[requirePendingScopedResetKind(context)]
                    .successAnnouncement,
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
                portabilityNotice:
                  playerDataResetCopy["delete-all-data"].successAnnouncement,
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
                portabilityIssue: playerDataPortabilityCopy.exportFailure,
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
              target: "#root.Hub",
              actions: assign({
                playerData: ({ event }) => event.output.head.playerData,
                battleProfileStoreState: ({ event }) => event.output,
                pendingImport: null,
                preImportBackupBytes: null,
                portabilityIssue: null,
                portabilityNotice: playerDataPortabilityCopy.importSuccess,
              }),
            },
            onError: {
              target: "ReviewingImport",
              actions: assign({
                preImportBackupBytes: null,
                portabilityIssue:
                  playerDataPortabilityCopy.importRestoreFailure,
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
            "ACHIEVEMENT.PRESENTED": {
              guard: "canRecordAchievementPresentation",
              target: "#root.RecordingAchievementPresentation",
              actions: assign({
                pendingAchievementPresentationId: ({ event }) =>
                  event.achievementId,
                achievementPresentationReturnTarget: "crucible",
              }),
            },
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
          on: {
            "ACHIEVEMENT.PRESENTED": {
              guard: "canRecordAchievementPresentation",
              actions: assign({
                pendingAchievementPresentationId: ({ event }) =>
                  event.achievementId,
                achievementPresentationReturnTarget: "crucible",
              }),
            },
          },
          invoke: {
            src: "commitBattleProfileEvent",
            input: ({ context }) => ({
              store: context.durableStore,
              state: requireBattleProfileStoreState(context),
              event: requirePendingBattleProfileCommit(context).event,
              committedAt: context.now(),
            }),
            onDone: [
              {
                guard: "hasPendingAchievementPresentation",
                target: "#root.RecordingAchievementPresentation",
                actions: assign({
                  playerData: ({ event }) => event.output.head.playerData,
                  battleProfileStoreState: ({ event }) => event.output,
                  pendingBattleProfileCommit: null,
                }),
              },
              {
                target: "Ready",
                actions: assign({
                  playerData: ({ event }) => event.output.head.playerData,
                  battleProfileStoreState: ({ event }) => event.output,
                  pendingBattleProfileCommit: null,
                }),
              },
            ],
            onError: {
              target: "#root.PersistenceFailure",
              actions: assign({
                pendingBattleProfileCommit: null,
                recoveryEntries: null,
                pendingRecoveryImportSource: null,
                persistenceFailureOrigin: "crucible",
                persistenceIssue: ({ event }) => getErrorMessage(event.error),
              }),
            },
          },
        },
      },
    },
    RecordingAchievementPresentation: {
      invoke: {
        src: "recordAchievementPresentation",
        input: ({ context }) => ({
          store: context.durableStore,
          state: requireBattleProfileStoreState(context),
          achievementId: requirePendingAchievementPresentationId(context),
          presentedAt: context.now(),
        }),
        onDone: [
          {
            guard: "shouldReturnAchievementPresentationToAchievements",
            target: "Achievements",
            actions: assign({
              playerData: ({ event }) => event.output.head.playerData,
              battleProfileStoreState: ({ event }) => event.output,
              ...CLEARED_ACHIEVEMENT_PRESENTATION_CONTEXT,
            }),
          },
          {
            guard: "shouldReturnAchievementPresentationToCrucible",
            target: "Crucible.Ready",
            actions: assign({
              playerData: ({ event }) => event.output.head.playerData,
              battleProfileStoreState: ({ event }) => event.output,
              ...CLEARED_ACHIEVEMENT_PRESENTATION_CONTEXT,
            }),
          },
          {
            target: "Hub",
            actions: assign({
              playerData: ({ event }) => event.output.head.playerData,
              battleProfileStoreState: ({ event }) => event.output,
              ...CLEARED_ACHIEVEMENT_PRESENTATION_CONTEXT,
            }),
          },
        ],
        onError: {
          target: "PersistenceFailure",
          actions: assign({
            recoveryEntries: null,
            pendingRecoveryImportSource: null,
            persistenceFailureOrigin: "achievement-presentation",
            persistenceIssue: ({ event }) => getErrorMessage(event.error),
          }),
        },
      },
    },
    PersistenceFailure: {
      initial: "Reviewing",
      states: {
        Reviewing: {
          on: {
            "RECOVERY.EXPORT_REQUESTED": {
              guard: "hasRecoveryEntries",
              target: "ExportingEvidence",
              actions: assign({
                preparedDownload: null,
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "RECOVERY.EXPORT_CONSUMED": {
              actions: assign({ preparedDownload: null }),
            },
            "RECOVERY.IMPORT_PREPARE_REQUESTED": {
              guard: "hasRecoveryEntries",
              target: "PreparingImport",
              actions: assign({
                pendingImportBytes: ({ event }) => event.serialized,
                pendingImport: null,
                pendingRecoveryImportSource: "selected-backup",
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "RECOVERY.RESTORE_BACKUP_REQUESTED": {
              guard: "hasStoredRecoveryBackup",
              target: "PreparingImport",
              actions: assign({
                pendingImportBytes: ({ context }) =>
                  requireStoredRecoveryBackup(context),
                pendingImport: null,
                pendingRecoveryImportSource: "last-known-good",
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "RECOVERY.DELETE_ALL_REQUESTED": {
              guard: "hasRecoveryEntries",
              target: "ReviewingDeletion",
              actions: assign({
                pendingResetReview: ({ context }) =>
                  createPendingResetReview(context, "delete-all-data"),
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "RECOVERY.PLATFORM_FAILURE_REPORTED": {
              actions: "reportRecoveryPlatformFailure",
            },
            "STORAGE_RECOVERY.EXPORT_REQUESTED": {
              guard: "canExportCurrentDataAfterStorageFailure",
              target: "ExportingCurrentData",
              actions: assign({
                preparedDownload: null,
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "STORAGE_RECOVERY.RETRY_REQUESTED": [
              {
                guard: "hasRecoveryEntries",
                target: "#root.LoadingProfile",
                actions: assign({
                  persistenceFailureOrigin: null,
                  persistenceIssue: null,
                  portabilityIssue: null,
                  portabilityNotice: null,
                }),
              },
              {
                guard: "isLoadingStorageFailure",
                target: "#root.LoadingProfile",
                actions: assign({
                  persistenceFailureOrigin: null,
                  persistenceIssue: null,
                  portabilityIssue: null,
                  portabilityNotice: null,
                }),
              },
              {
                guard: "isInitializationStorageFailure",
                target: "#root.InitializingProfile",
                actions: assign({
                  persistenceFailureOrigin: null,
                  persistenceIssue: null,
                  portabilityIssue: null,
                  portabilityNotice: null,
                }),
              },
              {
                guard: "isCrucibleStorageFailure",
                target: "#root.Crucible.Ready",
                actions: assign({
                  persistenceFailureOrigin: null,
                  persistenceIssue: null,
                  portabilityIssue: null,
                  portabilityNotice: null,
                }),
              },
              {
                guard: "isAchievementPresentationStorageFailure",
                target: "#root.RecordingAchievementPresentation",
                actions: assign({
                  persistenceFailureOrigin: null,
                  persistenceIssue: null,
                  portabilityIssue: null,
                  portabilityNotice: null,
                }),
              },
            ],
            "STORAGE_RECOVERY.RETURN_REQUESTED": [
              {
                guard: "isInitializationStorageFailure",
                target: "#root.Splash",
                actions: assign({
                  battleProfileStoreState: null,
                  persistenceFailureOrigin: null,
                  persistenceIssue: null,
                  portabilityIssue: null,
                  portabilityNotice: null,
                }),
              },
              {
                guard: "isCrucibleStorageFailure",
                target: "#root.Hub",
                actions: assign({
                  persistenceFailureOrigin: null,
                  persistenceIssue: null,
                  portabilityIssue: null,
                  portabilityNotice: null,
                }),
              },
              {
                guard:
                  "shouldReturnFailedAchievementPresentationToAchievements",
                target: "#root.Achievements",
                actions: assign({
                  ...CLEARED_ACHIEVEMENT_PRESENTATION_CONTEXT,
                  portabilityIssue: null,
                  portabilityNotice: null,
                }),
              },
              {
                guard: "shouldReturnFailedAchievementPresentationToCrucible",
                target: "#root.Crucible.Ready",
                actions: assign({
                  ...CLEARED_ACHIEVEMENT_PRESENTATION_CONTEXT,
                  portabilityIssue: null,
                  portabilityNotice: null,
                }),
              },
              {
                guard: "shouldReturnFailedAchievementPresentationToHub",
                target: "#root.Hub",
                actions: assign({
                  ...CLEARED_ACHIEVEMENT_PRESENTATION_CONTEXT,
                  portabilityIssue: null,
                  portabilityNotice: null,
                }),
              },
            ],
          },
        },
        ReviewingDeletion: {
          on: {
            "RECOVERY.EXPORT_REQUESTED": {
              guard: "hasRecoveryEntries",
              target: "ExportingEvidence",
              actions: assign({
                preparedDownload: null,
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "RECOVERY.EXPORT_CONSUMED": {
              actions: assign({ preparedDownload: null }),
            },
            "RECOVERY.DELETE_ALL_CANCEL_REQUESTED": {
              target: "Reviewing",
              actions: assign({
                pendingResetReview: null,
                portabilityIssue: null,
              }),
            },
            "RECOVERY.DELETE_ALL_CONFIRMED": {
              guard: "canConfirmRecoveryDeletion",
              target: "DeletingAllData",
              actions: assign({
                portabilityIssue: null,
                portabilityNotice: null,
              }),
            },
            "RECOVERY.PLATFORM_FAILURE_REPORTED": {
              actions: "reportRecoveryPlatformFailure",
            },
          },
        },
        ExportingCurrentData: {
          invoke: {
            src: "createWayvmExport",
            input: ({ context }) => ({
              exportedAt: context.now(),
              sourceAppVersion: context.appVersion,
              sourceBuild: context.sourceBuild,
              playerData: requirePlayerData(context),
            }),
            onDone: {
              target: "Reviewing",
              actions: assign({
                preparedDownload: ({ event }) => event.output,
                portabilityIssue: null,
                portabilityNotice:
                  playerDataRecoveryCopy.storageUnavailable.currentBackupReady,
              }),
            },
            onError: {
              target: "Reviewing",
              actions: assign({
                preparedDownload: null,
                portabilityIssue: ({ event }) => getErrorMessage(event.error),
              }),
            },
          },
        },
        ExportingEvidence: {
          invoke: {
            src: "createRecoveryBundle",
            input: ({ context }) => ({
              entries: requireRecoveryEntries(context),
              exportedAt: context.now(),
              issue: context.persistenceIssue ?? "Recovery is required",
              sourceAppVersion: context.appVersion,
              sourceBuild: context.sourceBuild,
            }),
            onDone: {
              target: "ReturningFromEvidenceExport",
              actions: assign({
                preparedDownload: ({ event }) => event.output,
                portabilityIssue: null,
                portabilityNotice:
                  playerDataRecoveryCopy.unreadableData.diagnosticReady,
              }),
            },
            onError: {
              target: "ReturningFromEvidenceExport",
              actions: assign({
                preparedDownload: null,
                portabilityIssue: ({ event }) => getErrorMessage(event.error),
              }),
            },
          },
        },
        ReturningFromEvidenceExport: {
          always: [
            {
              guard: "hasPendingResetReview",
              target: "ReviewingDeletion",
            },
            { target: "Reviewing" },
          ],
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
              target: "Reviewing",
              actions: assign({
                pendingImportBytes: null,
                pendingImport: null,
                pendingRecoveryImportSource: null,
                portabilityIssue: ({ event }) => getErrorMessage(event.error),
              }),
            },
          },
        },
        ReviewingImport: {
          on: {
            "RECOVERY.IMPORT_CANCEL_REQUESTED": {
              target: "Reviewing",
              actions: assign({
                pendingImport: null,
                pendingRecoveryImportSource: null,
                portabilityIssue: null,
              }),
            },
            "RECOVERY.IMPORT_CONFIRM_REQUESTED": {
              target: "ReplacingPlayerData",
              actions: assign({ portabilityIssue: null }),
            },
          },
        },
        ReplacingPlayerData: {
          invoke: {
            src: "replaceUnrecoverablePlayerData",
            input: ({ context }) => ({
              store: context.durableStore,
              entries: requireRecoveryEntries(context),
              playerData: requirePendingImport(context).wayvmExport.playerData,
              replacedAt: context.now(),
              appVersion: context.appVersion,
            }),
            onDone: {
              target: "#root.Hub",
              actions: assign({
                playerData: ({ event }) => event.output.head.playerData,
                battleProfileStoreState: ({ event }) => event.output,
                pendingImport: null,
                pendingImportBytes: null,
                preImportBackupBytes: null,
                preparedDownload: null,
                recoveryEntries: null,
                pendingRecoveryImportSource: null,
                persistenceFailureOrigin: null,
                persistenceIssue: null,
                portabilityIssue: null,
                portabilityNotice: ({ context }) =>
                  getRecoveryReplacementNotice(context),
              }),
            },
            onError: {
              target: "ReviewingImport",
              actions: assign({
                portabilityIssue: ({ event }) => getErrorMessage(event.error),
              }),
            },
          },
        },
        DeletingAllData: {
          invoke: {
            src: "deleteUnrecoverablePlayerData",
            input: ({ context }) => ({
              store: context.durableStore,
              entries: requireRecoveryEntries(context),
            }),
            onDone: {
              target: "#root.Splash",
              actions: assign({
                playerData: ({ context }) =>
                  createFreshPlayerDataAfterDeletion(context),
                battleProfileStoreState: null,
                pendingBattleProfileCommit: null,
                pendingImport: null,
                pendingImportBytes: null,
                preImportBackupBytes: null,
                preparedDownload: null,
                pendingResetReview: null,
                recoveryEntries: null,
                pendingRecoveryImportSource: null,
                persistenceFailureOrigin: null,
                persistenceIssue: null,
                portabilityIssue: null,
                portabilityNotice:
                  playerDataResetCopy["delete-all-data"].successAnnouncement,
              }),
            },
            onError: {
              target: "ReviewingDeletion",
              actions: assign({
                portabilityIssue: ({ event }) => getErrorMessage(event.error),
              }),
            },
          },
        },
      },
    },
  },
})
