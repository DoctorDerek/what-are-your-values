"use client"

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
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createIndexedDbDurableStore } from "@/lib/IndexedDbDurableStore"
import {
  downloadPlayerDataFile,
  readPlayerDataFile,
} from "@/lib/PlayerDataFiles"
import packageMetadata from "@/package.json"
import AchievementBanner from "./AchievementBanner"
import Achievements from "./Achievements"
import AllValues from "./AllValues"
import Crucible from "./Crucible"
import DataManagement, { type DataManagementActivity } from "./DataManagement"
import Hub from "./Hub"
import Recovery, { type RecoveryActivity } from "./Recovery"
import Splash from "./Splash"

export default function GameClient() {
  const durableStore = useMemo(() => createIndexedDbDurableStore(), [])
  const [state, send] = useMachine(rootMachine, {
    input: {
      durableStore,
      appVersion: packageMetadata.version,
      sourceBuild:
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "development",
      now: () => new Date().toISOString(),
    },
  })
  const isPersistenceFailure = state.matches("PersistenceFailure")
  const browseAllValuesButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusTargetIdRef = useRef("hub-browse-all-values-button")
  const [pendingAllValuesValueId, setPendingAllValuesValueId] =
    useState<ValueId | null>(null)
  const [shouldOpenCustomValueBuilder, setShouldOpenCustomValueBuilder] =
    useState(false)
  const shouldRestoreHubFocusRef = useRef(false)
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
  const handleAllValuesClose = useCallback(() => {
    send({ type: "ALL_VALUES.CLOSE_REQUESTED" })
  }, [send])
  const openAllValues = useCallback(
    ({
      focusTargetId,
      valueId,
      openCustomValueBuilder,
    }: {
      focusTargetId: string
      valueId?: ValueId | null
      openCustomValueBuilder?: boolean
    }) => {
      returnFocusTargetIdRef.current = focusTargetId
      setPendingAllValuesValueId(valueId ?? null)
      setShouldOpenCustomValueBuilder(openCustomValueBuilder === true)
      shouldRestoreHubFocusRef.current = true
      send({ type: "ALL_VALUES.OPEN_REQUESTED" })
    },
    [send],
  )
  const handleAddCustomValue = useCallback(
    (name: string, definition: string) => {
      setShouldOpenCustomValueBuilder(false)
      send({
        type: "ALL_VALUES.ADD_REQUESTED",
        name,
        definition,
      })
    },
    [send],
  )
  const handleUpdateCustomValue = useCallback(
    (valueId: CustomValueId, name: string, definition: string) => {
      send({
        type: "ALL_VALUES.UPDATE_REQUESTED",
        valueId,
        name,
        definition,
      })
    },
    [send],
  )
  const openDataManagement = useCallback(
    (focusTargetId: string) => {
      returnFocusTargetIdRef.current = focusTargetId
      shouldRestoreHubFocusRef.current = true
      send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    },
    [send],
  )
  const openAchievements = useCallback(
    (focusTargetId: string) => {
      returnFocusTargetIdRef.current = focusTargetId
      shouldRestoreHubFocusRef.current = true
      send({ type: "ACHIEVEMENTS.OPEN_REQUESTED" })
    },
    [send],
  )
  const handleAchievementPresented = useCallback(
    (achievementId: AchievementId) => {
      send({ type: "ACHIEVEMENT.PRESENTED", achievementId })
    },
    [send],
  )
  const handleImportFile = useCallback(
    async (file: File, destination: "data-management" | "recovery") => {
      try {
        const serialized = await readPlayerDataFile(file)
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

  useEffect(() => {
    send({
      type: "APP.HYDRATED",
      schedulerSeed: crypto.randomUUID(),
    })
  }, [send])

  useEffect(() => {
    const preparedDownload = state.context.preparedDownload
    if (!preparedDownload) {
      return
    }

    try {
      downloadPlayerDataFile(preparedDownload)
      send(
        isPersistenceFailure
          ? { type: "RECOVERY.EXPORT_CONSUMED" }
          : { type: "DATA_MANAGEMENT.EXPORT_CONSUMED" },
      )
    } catch (error: unknown) {
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
    }
  }, [isPersistenceFailure, send, state.context.preparedDownload])

  useEffect(() => {
    if (state.matches("Hub") && shouldRestoreHubFocusRef.current) {
      shouldRestoreHubFocusRef.current = false
      document.getElementById(returnFocusTargetIdRef.current)?.focus()
    }
  }, [state])

  if (
    state.matches("Hydrating") ||
    state.matches("LoadingProfile") ||
    state.matches("InitializingProfile")
  ) {
    return (
      <div className="noise-bg bg-mapache-vivid-dark text-mapache-vivid-primary-cyan flex h-[100dvh] w-[100dvw] items-center justify-center text-6xl font-black uppercase drop-shadow-[4px_4px_0px_#000000]">
        Booting Machine...
      </div>
    )
  }

  if (isPersistenceFailure) {
    let activity: RecoveryActivity | null = null
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
      <Recovery
        activity={activity}
        canExportCurrentData={
          state.context.persistenceFailureOrigin === "initialization" ||
          state.context.persistenceFailureOrigin === "crucible"
        }
        canReturnWithoutNewChanges={
          state.context.persistenceFailureOrigin === "initialization" ||
          state.context.persistenceFailureOrigin === "crucible"
        }
        canRetry={state.context.persistenceFailureOrigin !== null}
        hasCapturedData={state.context.recoveryEntries !== null}
        hasLastKnownGoodSave={
          state.context.recoveryEntries?.has(
            BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
          ) ?? false
        }
        importSource={state.context.pendingRecoveryImportSource}
        issue={state.context.portabilityIssue}
        notice={state.context.portabilityNotice}
        preview={state.context.pendingImport?.preview ?? null}
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
        onImportFile={(file) => handleImportFile(file, "recovery")}
        onRestoreLastKnownGoodSave={() =>
          send({ type: "RECOVERY.RESTORE_BACKUP_REQUESTED" })
        }
        onRetry={() => send({ type: "STORAGE_RECOVERY.RETRY_REQUESTED" })}
        onReturnWithoutNewChanges={() =>
          send({ type: "STORAGE_RECOVERY.RETURN_REQUESTED" })
        }
      />
    )
  }

  if (state.matches("Splash")) {
    return (
      <Splash
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
    <AchievementBanner
      unlock={pendingAchievementUnlock}
      isPresentationPersistencePending={isRecordingAchievementPresentation}
      onPresented={handleAchievementPresented}
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
      <>
        <Hub
          notice={state.context.portabilityNotice}
          rankedValues={rankedValues}
          browseAllValuesButtonRef={browseAllValuesButtonRef}
          onBrowseAllValues={(focusTargetId) =>
            openAllValues({ focusTargetId })
          }
          onAddCustomValue={(focusTargetId) =>
            openAllValues({ focusTargetId, openCustomValueBuilder: true })
          }
          onOpenAchievements={openAchievements}
          onManageData={openDataManagement}
          onOpenValue={(valueId, focusTargetId) =>
            openAllValues({ focusTargetId, valueId })
          }
          onStartBattle={() => send({ type: "BATTLE.START_REQUESTED" })}
        />
        {achievementBanner}
      </>
    )
  }

  if (isAchievementsSurface) {
    return (
      <>
        <Achievements
          achievementState={playerData.achievements}
          battleProfile={battleProfile}
          onClose={() => send({ type: "ACHIEVEMENTS.CLOSE_REQUESTED" })}
        />
        {achievementBanner}
      </>
    )
  }

  if (state.matches("DataManagement")) {
    let activity: DataManagementActivity | null = null
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
      <DataManagement
        activity={activity}
        canDeleteCustomValues={battleProfile.activeDeck.customValues.length > 0}
        issue={state.context.portabilityIssue}
        notice={state.context.portabilityNotice}
        preview={state.context.pendingImport?.preview ?? null}
        resetKind={state.context.pendingResetKind}
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
        onImportFile={(file) => handleImportFile(file, "data-management")}
        onOpenReset={(resetKind) =>
          send({
            type: "DATA_MANAGEMENT.RESET_OPEN_REQUESTED",
            resetKind,
          })
        }
      />
    )
  }

  if (state.matches("AllValues")) {
    return (
      <AllValues
        key={battleProfile.scheduler.deckRevision}
        rankedValues={rankedValues}
        initialValueId={pendingAllValuesValueId}
        openCustomValueBuilder={shouldOpenCustomValueBuilder}
        isPersistencePending={state.matches({ AllValues: "Persisting" })}
        persistenceIssue={state.context.persistenceIssue}
        onClose={handleAllValuesClose}
        onAddCustomValue={handleAddCustomValue}
        onUpdateCustomValue={handleUpdateCustomValue}
        onDeleteCustomValue={(valueId) =>
          send({ type: "ALL_VALUES.DELETE_REQUESTED", valueId })
        }
      />
    )
  }

  if (isCrucibleSurface) {
    const isBattleReady = state.matches({ Crucible: "Ready" })

    return (
      <>
        <Crucible
          activeDeck={battleProfile.activeDeck}
          battle={presentedBattle}
          progressById={battleProfile.progressById}
          canUndo={battleProfile.history.length > 0}
          canRedo={battleProfile.redo.length > 0}
          hasAchievementBanner={pendingAchievementUnlock !== null}
          isPersistencePending={!isBattleReady}
          onExit={() => send({ type: "BATTLE.EXIT_REQUESTED" })}
          onUndo={() => send({ type: "BATTLE.UNDO_REQUESTED" })}
          onRedo={() => send({ type: "BATTLE.REDO_REQUESTED" })}
          onWinnerSelected={handleWinnerSelected}
        />
        {achievementBanner}
      </>
    )
  }

  return null
}
