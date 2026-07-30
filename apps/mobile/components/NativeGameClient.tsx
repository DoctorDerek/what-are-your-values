import type { CustomValueId, ValueId } from "@game/data/src/Value"
import { rankValues } from "@game/data/src/ValueRanking"
import type { AchievementId } from "@game/machines/src/AchievementCatalog"
import { getPendingAchievementUnlocks } from "@game/machines/src/AchievementState"
import { BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY } from "@game/machines/src/BattleProfileStore"
import {
  projectBattlePair,
  type BattleSchedulerRestorePoint,
} from "@game/machines/src/BattleScheduler"
import { rootMachine } from "@game/machines/src/RootMachine"
import { getErrorMessage } from "@game/utils/src/Errors"
import { useMachine } from "@xstate/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import NativeAchievementBanner from "@/components/NativeAchievementBanner"
import NativeAchievements from "@/components/NativeAchievements"
import NativeAllValues from "@/components/NativeAllValues"
import NativeBoot from "@/components/NativeBoot"
import NativeCrucible from "@/components/NativeCrucible"
import NativeDataManagement, {
  type NativeDataManagementActivity,
} from "@/components/NativeDataManagement"
import NativeHub from "@/components/NativeHub"
import NativeRecovery, {
  type NativeRecoveryActivity,
} from "@/components/NativeRecovery"
import NativeSplash from "@/components/NativeSplash"
import { expoDurableStore } from "@/lib/ExpoDurableStore"
import { expoPlayerDataFileAdapter } from "@/lib/ExpoPlayerDataFiles"
import packageMetadata from "@/package.json"

const getCurrentTimestamp = () => new Date().toISOString()
const sourceBuild = process.env.EXPO_PUBLIC_SOURCE_BUILD ?? "development"

export default function NativeGameClient() {
  const [state, send] = useMachine(rootMachine, {
    input: {
      durableStore: expoDurableStore,
      appVersion: packageMetadata.version,
      sourceBuild,
      now: getCurrentTimestamp,
    },
  })
  const [pendingAllValuesValueId, setPendingAllValuesValueId] =
    useState<ValueId | null>(null)
  const [shouldOpenCustomValueBuilder, setShouldOpenCustomValueBuilder] =
    useState(false)
  const isPersistenceFailure = state.matches("PersistenceFailure")
  const playerData = state.context.playerData
  const battleProfile = playerData?.profile ?? null
  const rankedValues = useMemo(
    () =>
      battleProfile
        ? rankValues(battleProfile.activeDeck, battleProfile.progressById)
        : [],
    [battleProfile],
  )
  const presentedBattle = useMemo(
    () =>
      battleProfile
        ? Object.freeze({
            pair: projectBattlePair(
              battleProfile.activeDeck,
              battleProfile.scheduler,
            ),
            scheduler: battleProfile.scheduler,
          })
        : null,
    [battleProfile],
  )

  useEffect(() => {
    send({
      type: "APP.HYDRATED",
      schedulerSeed: globalThis.crypto.randomUUID(),
    })
  }, [send])

  useEffect(() => {
    const preparedDownload = state.context.preparedDownload
    if (!preparedDownload) {
      return
    }

    void expoPlayerDataFileAdapter
      .exportJson(preparedDownload)
      .then(() => {
        send(
          isPersistenceFailure
            ? { type: "RECOVERY.EXPORT_CONSUMED" }
            : { type: "DATA_MANAGEMENT.EXPORT_CONSUMED" },
        )
      })
      .catch((error: unknown) => {
        send(
          isPersistenceFailure
            ? {
                type: "RECOVERY.PLATFORM_FAILURE_REPORTED",
                issue: getErrorMessage(error),
              }
            : {
                type: "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED",
                issue: getErrorMessage(error),
              },
        )
      })
  }, [isPersistenceFailure, send, state.context.preparedDownload])

  const importPlayerData = useCallback(
    async (destination: "data-management" | "recovery") => {
      try {
        const serialized = await expoPlayerDataFileAdapter.selectJsonForImport()
        if (serialized === null) {
          return
        }

        send(
          destination === "recovery"
            ? {
                type: "RECOVERY.IMPORT_PREPARE_REQUESTED",
                serialized,
              }
            : {
                type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
                serialized,
              },
        )
      } catch (error: unknown) {
        send(
          destination === "recovery"
            ? {
                type: "RECOVERY.PLATFORM_FAILURE_REPORTED",
                issue: getErrorMessage(error),
              }
            : {
                type: "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED",
                issue: getErrorMessage(error),
              },
        )
      }
    },
    [send],
  )
  const handleWinnerSelected = useCallback(
    (winnerId: ValueId, expectedScheduler: BattleSchedulerRestorePoint) => {
      send({
        type: "BATTLE.WINNER_SELECTED",
        winnerId,
        expectedScheduler,
      })
    },
    [send],
  )
  const handleAchievementPresented = useCallback(
    (achievementId: AchievementId) => {
      send({ type: "ACHIEVEMENT.PRESENTED", achievementId })
    },
    [send],
  )

  if (
    state.matches("Hydrating") ||
    state.matches("LoadingProfile") ||
    state.matches("InitializingProfile")
  ) {
    return <NativeBoot />
  }

  if (isPersistenceFailure) {
    let activity: NativeRecoveryActivity | null = null
    const canRecoverCurrentData =
      state.context.persistenceFailureOrigin !== null &&
      state.context.persistenceFailureOrigin !== "loading"
    if (
      state.matches({ PersistenceFailure: "PreparingStoredBackup" }) ||
      state.matches({ PersistenceFailure: "PreparingImport" })
    ) {
      activity = "Checking backup…"
    } else if (state.matches({ PersistenceFailure: "ExportingEvidence" })) {
      activity = "Exporting unreadable data…"
    } else if (state.matches({ PersistenceFailure: "ReplacingPlayerData" })) {
      activity = "Replacing unreadable data…"
    } else if (state.matches({ PersistenceFailure: "DeletingAllData" })) {
      activity = "Deleting local data…"
    } else if (state.matches({ PersistenceFailure: "ExportingCurrentData" })) {
      activity = "Exporting current data…"
    }

    return (
      <NativeRecovery
        activity={activity}
        canExportCurrentData={canRecoverCurrentData}
        canRetry={state.context.persistenceFailureOrigin !== null}
        canReturnWithoutNewChanges={canRecoverCurrentData}
        hasCapturedData={state.context.recoveryEntries !== null}
        hasLastKnownGoodSave={
          state.context.recoveryEntries?.has(
            BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
          ) ?? false
        }
        importSource={state.context.pendingRecoveryImportSource}
        issue={state.context.portabilityIssue}
        notice={state.context.portabilityNotice}
        onCancelImport={() =>
          send({ type: "RECOVERY.IMPORT_CANCEL_REQUESTED" })
        }
        onConfirmImport={() =>
          send({ type: "RECOVERY.IMPORT_CONFIRM_REQUESTED" })
        }
        onDeleteAllData={(acknowledged) =>
          send({
            type: "RECOVERY.DELETE_ALL_REQUESTED",
            acknowledged,
          })
        }
        onExportCurrentData={() =>
          send({ type: "STORAGE_RECOVERY.EXPORT_REQUESTED" })
        }
        onExportUnreadableData={() =>
          send({ type: "RECOVERY.EXPORT_REQUESTED" })
        }
        onImport={() => void importPlayerData("recovery")}
        onRestoreLastKnownGoodSave={() =>
          send({ type: "RECOVERY.RESTORE_BACKUP_REQUESTED" })
        }
        onRetry={() => send({ type: "STORAGE_RECOVERY.RETRY_REQUESTED" })}
        onReturnWithoutNewChanges={() =>
          send({ type: "STORAGE_RECOVERY.RETURN_REQUESTED" })
        }
        preview={state.context.pendingImport?.preview ?? null}
      />
    )
  }

  if (state.matches("Splash")) {
    return (
      <NativeSplash
        announcement={state.context.portabilityNotice}
        onComplete={() => send({ type: "INTRODUCTION.COMPLETED" })}
      />
    )
  }

  if (!playerData || !battleProfile || !presentedBattle) {
    throw new Error("Battle profile is unavailable after hydration")
  }

  const isRecordingAchievementPresentation = state.matches(
    "RecordingAchievementPresentation",
  )
  const achievementPresentationReturnTarget =
    state.context.achievementPresentationReturnTarget
  const pendingAchievementUnlock =
    getPendingAchievementUnlocks(playerData.achievements)[0] ?? null
  const achievementBanner = (
    <NativeAchievementBanner
      isPresentationPersistencePending={isRecordingAchievementPresentation}
      onPresented={handleAchievementPresented}
      unlock={pendingAchievementUnlock}
    />
  )
  const isHubSurface =
    state.matches("Hub") ||
    (isRecordingAchievementPresentation &&
      achievementPresentationReturnTarget === "hub")
  const isAchievementsSurface =
    state.matches("Achievements") ||
    (isRecordingAchievementPresentation &&
      achievementPresentationReturnTarget === "achievements")
  const isCrucibleSurface =
    state.matches("Crucible") ||
    (isRecordingAchievementPresentation &&
      achievementPresentationReturnTarget === "crucible")

  if (isHubSurface) {
    return (
      <View style={styles.root}>
        <NativeHub
          notice={state.context.portabilityNotice}
          onAddCustomValue={() => {
            setPendingAllValuesValueId(null)
            setShouldOpenCustomValueBuilder(true)
            send({ type: "ALL_VALUES.OPEN_REQUESTED" })
          }}
          onBrowseAllValues={() => {
            setPendingAllValuesValueId(null)
            setShouldOpenCustomValueBuilder(false)
            send({ type: "ALL_VALUES.OPEN_REQUESTED" })
          }}
          onManageData={() => send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })}
          onOpenAchievements={() =>
            send({ type: "ACHIEVEMENTS.OPEN_REQUESTED" })
          }
          onOpenValue={(valueId) => {
            setPendingAllValuesValueId(valueId)
            setShouldOpenCustomValueBuilder(false)
            send({ type: "ALL_VALUES.OPEN_REQUESTED" })
          }}
          onStartBattle={() => send({ type: "BATTLE.START_REQUESTED" })}
          rankedValues={rankedValues}
        />
        {achievementBanner}
      </View>
    )
  }

  if (isAchievementsSurface) {
    return (
      <View style={styles.root}>
        <NativeAchievements
          achievementState={playerData.achievements}
          battleProfile={battleProfile}
          onClose={() => send({ type: "ACHIEVEMENTS.CLOSE_REQUESTED" })}
        />
        {achievementBanner}
      </View>
    )
  }

  if (state.matches("DataManagement")) {
    let activity: NativeDataManagementActivity | null = null
    if (state.matches({ DataManagement: "Exporting" })) {
      activity = "Exporting backup…"
    } else if (state.matches({ DataManagement: "PreparingImport" })) {
      activity = "Checking backup…"
    } else if (state.matches({ DataManagement: "CreatingPreImportBackup" })) {
      activity = "Creating recovery backup…"
    } else if (state.matches({ DataManagement: "ReplacingImport" })) {
      activity = "Replacing local data…"
    } else if (state.matches({ DataManagement: "ApplyingScopedReset" })) {
      activity = "Applying reset…"
    } else if (state.matches({ DataManagement: "DeletingAllData" })) {
      activity = "Deleting local data…"
    } else if (state.matches({ DataManagement: "ExportingResetBackup" })) {
      activity = "Exporting backup…"
    }

    return (
      <NativeDataManagement
        activity={activity}
        canDeleteCustomValues={battleProfile.activeDeck.customValues.length > 0}
        issue={state.context.portabilityIssue}
        notice={state.context.portabilityNotice}
        onCancelImport={() =>
          send({ type: "DATA_MANAGEMENT.IMPORT_CANCEL_REQUESTED" })
        }
        onCancelReset={() =>
          send({ type: "DATA_MANAGEMENT.RESET_CANCEL_REQUESTED" })
        }
        onClose={() => send({ type: "DATA_MANAGEMENT.CLOSE_REQUESTED" })}
        onConfirmImport={() =>
          send({ type: "DATA_MANAGEMENT.IMPORT_CONFIRM_REQUESTED" })
        }
        onConfirmReset={(deleteAllDataAcknowledged) =>
          send({
            type: "DATA_MANAGEMENT.RESET_CONFIRM_REQUESTED",
            deleteAllDataAcknowledged,
          })
        }
        onExport={() => send({ type: "DATA_MANAGEMENT.EXPORT_REQUESTED" })}
        onImport={() => void importPlayerData("data-management")}
        onOpenReset={(resetKind) =>
          send({
            type: "DATA_MANAGEMENT.RESET_OPEN_REQUESTED",
            resetKind,
          })
        }
        preview={state.context.pendingImport?.preview ?? null}
        resetKind={state.context.pendingResetKind}
      />
    )
  }

  if (state.matches("AllValues")) {
    return (
      <NativeAllValues
        key={battleProfile.scheduler.deckRevision}
        initialValueId={pendingAllValuesValueId}
        isPersistencePending={state.matches({ AllValues: "Persisting" })}
        onAddCustomValue={(name, definition) => {
          setShouldOpenCustomValueBuilder(false)
          send({
            type: "ALL_VALUES.ADD_REQUESTED",
            name,
            definition,
          })
        }}
        onClose={() => send({ type: "ALL_VALUES.CLOSE_REQUESTED" })}
        onDeleteCustomValue={(valueId) =>
          send({ type: "ALL_VALUES.DELETE_REQUESTED", valueId })
        }
        onUpdateCustomValue={(valueId: CustomValueId, name, definition) =>
          send({
            type: "ALL_VALUES.UPDATE_REQUESTED",
            valueId,
            name,
            definition,
          })
        }
        openCustomValueBuilder={shouldOpenCustomValueBuilder}
        persistenceIssue={state.context.persistenceIssue}
        rankedValues={rankedValues}
      />
    )
  }

  if (isCrucibleSurface) {
    const isBattleReady = state.matches({ Crucible: "Ready" })

    return (
      <View style={styles.root}>
        <NativeCrucible
          activeDeck={battleProfile.activeDeck}
          battle={presentedBattle}
          canRedo={battleProfile.redo.length > 0}
          canUndo={battleProfile.history.length > 0}
          isPersistencePending={!isBattleReady}
          onExit={() => send({ type: "BATTLE.EXIT_REQUESTED" })}
          onRedo={() => send({ type: "BATTLE.REDO_REQUESTED" })}
          onUndo={() => send({ type: "BATTLE.UNDO_REQUESTED" })}
          onWinnerSelected={handleWinnerSelected}
          progressById={battleProfile.progressById}
        />
        {achievementBanner}
      </View>
    )
  }

  return null
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
