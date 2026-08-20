"use client"

import {
  PRODUCT_MENU_COPY,
  type ProductMenuDestinationId,
} from "@game/data/src/ProductMenu"
import type { CustomValueId, ValueId } from "@game/data/src/Value"
import { rankValues } from "@game/data/src/ValueRanking"
import {
  getPendingAchievementPresentation,
  projectAchievementCatalog,
  type AchievementPresentation,
} from "@game/machines/src/AchievementPresentation"
import { inspectBattleProfileStore } from "@game/machines/src/BattleProfileHydration"
import { BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY } from "@game/machines/src/BattleProfileStore"
import {
  projectBattlePair,
  type BattleSchedulerRestorePoint,
} from "@game/machines/src/BattleScheduler"
import type { DurableStoreAdapter } from "@game/machines/src/DurableStoreAdapter"
import { prepareWayvmDownload } from "@game/machines/src/PlayerDataPortabilityActors"
import { playerDataPortabilityCopy } from "@game/machines/src/PlayerDataPortabilityCopy"
import {
  DELETE_ALL_DATA_ACKNOWLEDGMENT,
  type PlayerDataResetKind,
  type PlayerDataResetReview,
} from "@game/machines/src/PlayerDataReset"
import { rootMachine } from "@game/machines/src/RootMachine"
import { getErrorMessage } from "@game/utils/src/Errors"
import { useMachine } from "@xstate/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ProductMenu from "@/components/ProductMenu"
import { createIndexedDbDurableStore } from "@/lib/IndexedDbDurableStore"
import {
  downloadPlayerDataFile,
  readPlayerDataFile,
} from "@/lib/PlayerDataFiles"
import useWebExclusiveWriterLease from "@/lib/useWebExclusiveWriterLease"
import packageMetadata from "@/package.json"
import AchievementBanner from "./AchievementBanner"
import Achievements from "./Achievements"
import AllValues from "./AllValues"
import Crucible from "./Crucible"
import DataManagement, { type DataManagementActivity } from "./DataManagement"
import Hub, { HUB_MENU_BUTTON_ID } from "./Hub"
import PlayerDataLoading from "./PlayerDataLoading"
import PlayerDataRecovery, {
  type PlayerDataRecoveryActivity,
} from "./PlayerDataRecovery"
import Splash from "./Splash"
import WebWriterConflict from "./WebWriterConflict"

const SOURCE_APP_VERSION = packageMetadata.version
const SOURCE_BUILD =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "development"

function ReadOnlyGameClient({
  durableStore,
}: {
  readonly durableStore: DurableStoreAdapter
}) {
  const [isExportPending, setIsExportPending] = useState(false)
  const [issue, setIssue] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const handleExportThisTab = useCallback(async () => {
    setIsExportPending(true)
    setIssue(null)
    setNotice(null)

    try {
      const inspection = await inspectBattleProfileStore({
        store: durableStore,
        appVersion: SOURCE_APP_VERSION,
      })
      if (inspection.status !== "ready") {
        setIssue(playerDataPortabilityCopy.exportFailure)
        return
      }

      const preparedDownload = await prepareWayvmDownload({
        exportedAt: new Date().toISOString(),
        sourceAppVersion: SOURCE_APP_VERSION,
        sourceBuild: SOURCE_BUILD,
        playerData: inspection.state.head.playerData,
      })
      downloadPlayerDataFile(preparedDownload)
      setNotice(playerDataPortabilityCopy.exportSuccess)
    } catch {
      setIssue(playerDataPortabilityCopy.exportFailure)
    } finally {
      setIsExportPending(false)
    }
  }, [durableStore])

  return (
    <WebWriterConflict
      isExportPending={isExportPending}
      issue={issue}
      notice={notice}
      onExportThisTab={() => void handleExportThisTab()}
      onLoadLatest={() => window.location.reload()}
    />
  )
}

function WritableGameClient({
  durableStore,
}: {
  readonly durableStore: DurableStoreAdapter
}) {
  const [state, send] = useMachine(rootMachine, {
    input: {
      durableStore,
      appVersion: SOURCE_APP_VERSION,
      sourceBuild: SOURCE_BUILD,
      now: () => new Date().toISOString(),
      randomUuid: () => crypto.randomUUID(),
    },
  })
  const browseAllValuesButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusTargetIdRef = useRef("hub-browse-all-values-button")
  const [pendingAllValuesValueId, setPendingAllValuesValueId] =
    useState<ValueId | null>(null)
  const [shouldOpenCustomValueBuilder, setShouldOpenCustomValueBuilder] =
    useState(false)
  const shouldRestoreHubFocusRef = useRef(false)
  const deliveredDownloadsRef = useRef(new WeakSet<object>())
  const [isReadingImportFile, setIsReadingImportFile] = useState(false)
  const [isReadingRecoveryImportFile, setIsReadingRecoveryImportFile] =
    useState(false)
  const [isProductMenuOpen, setIsProductMenuOpen] = useState(false)
  const playerData = state.context.playerData
  const battleProfile = playerData?.profile ?? null
  const rankedValues = useMemo(
    () =>
      battleProfile
        ? rankValues(battleProfile.activeDeck, battleProfile.progressById)
        : [],
    [battleProfile],
  )
  const achievementPresentations = useMemo(
    () =>
      playerData
        ? projectAchievementCatalog({
            achievementState: playerData.achievements,
            battleProfile: playerData.profile,
          })
        : [],
    [playerData],
  )
  const pendingAchievementPresentation = useMemo(() => {
    if (!playerData) return null

    return getPendingAchievementPresentation({
      achievementState: playerData.achievements,
      achievementPresentations,
    })
  }, [achievementPresentations, playerData])
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
  const handleProductMenuDestinationSelect = useCallback(
    (destinationId: ProductMenuDestinationId) => {
      setIsProductMenuOpen(false)
      const destinationActions = {
        "browse-all-values": () =>
          openAllValues({ focusTargetId: HUB_MENU_BUTTON_ID }),
        "custom-values": () =>
          openAllValues({
            focusTargetId: HUB_MENU_BUTTON_ID,
            openCustomValueBuilder: true,
          }),
        achievements: () => openAchievements(HUB_MENU_BUTTON_ID),
        "import-export": () => openDataManagement(HUB_MENU_BUTTON_ID),
      } satisfies Record<ProductMenuDestinationId, () => void>

      destinationActions[destinationId]()
    },
    [openAchievements, openAllValues, openDataManagement],
  )
  const handleAchievementPresented = useCallback(
    (achievementId: AchievementPresentation["id"]) => {
      send({ type: "ACHIEVEMENT.PRESENTED", achievementId })
    },
    [send],
  )
  const handleImportFile = useCallback(
    async (file: File) => {
      send({ type: "DATA_MANAGEMENT.IMPORT_FILE_READ_REQUESTED" })
      setIsReadingImportFile(true)
      try {
        const serialized = await readPlayerDataFile(file)
        send({
          type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
          serialized,
        })
      } catch (error) {
        send({
          type: "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED",
          issue: getErrorMessage(error),
        })
      } finally {
        setIsReadingImportFile(false)
      }
    },
    [send],
  )
  const handleResetRequested = useCallback(
    (resetKind: PlayerDataResetKind) => {
      if (resetKind === "delete-all-custom-values")
        return send({ type: "CUSTOM_VALUE.DELETE_ALL_REQUESTED" })
      if (resetKind === "reset-levels-and-experience")
        return send({ type: "RESET.LEVELS_AND_EXPERIENCE_REQUESTED" })
      if (resetKind === "reset-achievements")
        return send({ type: "RESET.ACHIEVEMENTS_REQUESTED" })

      return send({ type: "DELETE_ALL_DATA.REQUESTED" })
    },
    [send],
  )
  const handleRecoveryImportFile = useCallback(
    async (file: File) => {
      setIsReadingRecoveryImportFile(true)
      try {
        const serialized = await readPlayerDataFile(file)
        send({
          type: "RECOVERY.IMPORT_PREPARE_REQUESTED",
          serialized,
        })
      } catch (error) {
        send({
          type: "RECOVERY.PLATFORM_FAILURE_REPORTED",
          issue: getErrorMessage(error),
        })
      } finally {
        setIsReadingRecoveryImportFile(false)
      }
    },
    [send],
  )
  const handleResetConfirmed = useCallback(
    (review: PlayerDataResetReview) => {
      const { confirmationId, resetKind } = review
      if (resetKind === "delete-all-custom-values")
        return send({
          type: "CUSTOM_VALUE.DELETE_ALL_CONFIRMED",
          confirmationId,
        })
      if (resetKind === "reset-levels-and-experience")
        return send({
          type: "RESET.LEVELS_AND_EXPERIENCE_CONFIRMED",
          confirmationId,
        })
      if (resetKind === "reset-achievements")
        return send({
          type: "RESET.ACHIEVEMENTS_CONFIRMED",
          confirmationId,
        })

      return send({
        type: "DELETE_ALL_DATA.CONFIRMED",
        confirmationId,
        phrase: DELETE_ALL_DATA_ACKNOWLEDGMENT,
      })
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
    if (state.matches("Hub") && shouldRestoreHubFocusRef.current) {
      shouldRestoreHubFocusRef.current = false
      document.getElementById(returnFocusTargetIdRef.current)?.focus()
    }
  }, [state])

  useEffect(() => {
    const preparedDownload = state.context.preparedDownload
    const isDataManagementDownload = state.matches("DataManagement")
    const isRecoveryDownload = state.matches("PersistenceFailure")
    if (
      (!isDataManagementDownload && !isRecoveryDownload) ||
      !preparedDownload ||
      deliveredDownloadsRef.current.has(preparedDownload)
    )
      return

    deliveredDownloadsRef.current.add(preparedDownload)
    try {
      downloadPlayerDataFile(preparedDownload)
      if (isDataManagementDownload)
        send({ type: "DATA_MANAGEMENT.EXPORT_CONSUMED" })
      if (isRecoveryDownload) send({ type: "RECOVERY.EXPORT_CONSUMED" })
    } catch {
      if (isDataManagementDownload)
        send({
          type: "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED",
          issue: playerDataPortabilityCopy.exportFailure,
        })
      if (isRecoveryDownload)
        send({
          type: "RECOVERY.PLATFORM_FAILURE_REPORTED",
          issue: playerDataPortabilityCopy.exportFailure,
        })
    }
  }, [send, state])

  const dataManagementActivity: DataManagementActivity | null =
    isReadingImportFile || state.matches({ DataManagement: "PreparingImport" })
      ? "Checking backup…"
      : state.matches({ DataManagement: "Exporting" })
        ? "Creating backup…"
        : state.matches({ DataManagement: "CreatingPreImportBackup" })
          ? "Creating safety backup…"
          : state.matches({ DataManagement: "ReplacingImport" })
            ? "Restoring backup…"
            : state.matches({ DataManagement: "ExportingResetBackup" })
              ? "Creating backup…"
              : state.matches({ DataManagement: "ApplyingScopedReset" })
                ? "Applying reset…"
                : state.matches({ DataManagement: "DeletingAllData" })
                  ? "Deleting data…"
                  : null
  const playerDataRecoveryActivity: PlayerDataRecoveryActivity | null =
    isReadingRecoveryImportFile ||
    state.matches({ PersistenceFailure: "PreparingImport" })
      ? "Checking backup…"
      : state.matches({ PersistenceFailure: "ExportingCurrentData" })
        ? "Creating backup…"
        : state.matches({ PersistenceFailure: "ExportingEvidence" })
          ? "Creating diagnostic file…"
          : state.matches({ PersistenceFailure: "ReplacingPlayerData" })
            ? "Restoring backup…"
            : state.matches({ PersistenceFailure: "DeletingAllData" })
              ? "Deleting data…"
              : null

  if (
    state.matches("Hydrating") ||
    state.matches("LoadingProfile") ||
    state.matches("InitializingProfile")
  ) {
    return <PlayerDataLoading />
  }

  if (state.matches("PersistenceFailure")) {
    const issue =
      state.context.portabilityIssue ?? state.context.persistenceIssue
    const hasRecoveryEntries = state.context.recoveryEntries !== null

    if (hasRecoveryEntries)
      return (
        <PlayerDataRecovery
          mode="unreadable-data"
          activity={playerDataRecoveryActivity}
          hasLastKnownGoodSave={
            state.context.recoveryEntries?.has(
              BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
            ) ?? false
          }
          issue={issue}
          notice={state.context.portabilityNotice}
          pendingImportSource={state.context.pendingRecoveryImportSource}
          preview={state.context.pendingImport?.preview ?? null}
          resetReview={state.context.pendingResetReview}
          onCancelImport={() =>
            send({ type: "RECOVERY.IMPORT_CANCEL_REQUESTED" })
          }
          onCancelReset={() =>
            send({ type: "RECOVERY.DELETE_ALL_CANCEL_REQUESTED" })
          }
          onConfirmImport={() =>
            send({ type: "RECOVERY.IMPORT_CONFIRM_REQUESTED" })
          }
          onConfirmReset={(review) =>
            send({
              type: "RECOVERY.DELETE_ALL_CONFIRMED",
              confirmationId: review.confirmationId,
              phrase: DELETE_ALL_DATA_ACKNOWLEDGMENT,
            })
          }
          onDeleteAllData={() =>
            send({ type: "RECOVERY.DELETE_ALL_REQUESTED" })
          }
          onExportUnreadableData={() =>
            send({ type: "RECOVERY.EXPORT_REQUESTED" })
          }
          onImportFile={(file) => void handleRecoveryImportFile(file)}
          onRestoreLastKnownGoodSave={() =>
            send({ type: "RECOVERY.RESTORE_BACKUP_REQUESTED" })
          }
          onTryAgain={() => send({ type: "STORAGE_RECOVERY.RETRY_REQUESTED" })}
        />
      )

    const canExportCurrentData =
      state.context.playerData !== null &&
      state.context.persistenceFailureOrigin !== null &&
      state.context.persistenceFailureOrigin !== "loading"
    const canReturnWithoutNewChanges =
      state.context.persistenceFailureOrigin === "initialization" ||
      state.context.persistenceFailureOrigin === "crucible" ||
      state.context.persistenceFailureOrigin === "achievement-presentation"

    return (
      <PlayerDataRecovery
        mode="storage-unavailable"
        activity={playerDataRecoveryActivity}
        canExportCurrentData={canExportCurrentData}
        canReturnWithoutNewChanges={canReturnWithoutNewChanges}
        issue={issue}
        notice={state.context.portabilityNotice}
        onExportCurrentData={() =>
          send({ type: "STORAGE_RECOVERY.EXPORT_REQUESTED" })
        }
        onReturnWithoutNewChanges={() =>
          send({ type: "STORAGE_RECOVERY.RETURN_REQUESTED" })
        }
        onTryAgain={() => send({ type: "STORAGE_RECOVERY.RETRY_REQUESTED" })}
      />
    )
  }

  if (state.matches("Splash")) {
    return (
      <Splash
        notice={state.context.portabilityNotice}
        onComplete={() => send({ type: "INTRODUCTION.COMPLETED" })}
      />
    )
  }

  if (!battleProfile || !presentedBattle) {
    throw new Error("Battle profile is unavailable after hydration")
  }

  const isRecordingAchievementPresentation = state.matches(
    "RecordingAchievementPresentation",
  )
  const achievementPresentationReturnTarget =
    state.context.achievementPresentationReturnTarget
  const achievementBanner = (
    <AchievementBanner
      achievement={pendingAchievementPresentation}
      isAcknowledgementPending={isRecordingAchievementPresentation}
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
          rankedValues={rankedValues}
          browseAllValuesButtonRef={browseAllValuesButtonRef}
          dataNotice={state.context.portabilityNotice}
          onBrowseAllValues={(focusTargetId) =>
            openAllValues({ focusTargetId })
          }
          onAddCustomValue={(focusTargetId) =>
            openAllValues({ focusTargetId, openCustomValueBuilder: true })
          }
          onOpenMenu={() => setIsProductMenuOpen(true)}
          onOpenValue={(valueId, focusTargetId) =>
            openAllValues({ focusTargetId, valueId })
          }
          onStartBattle={() => send({ type: "BATTLE.START_REQUESTED" })}
        />
        <ProductMenu
          contextActionLabel={PRODUCT_MENU_COPY.closeAction}
          open={isProductMenuOpen}
          onDestinationSelect={handleProductMenuDestinationSelect}
          onOpenChange={setIsProductMenuOpen}
        />
        {achievementBanner}
      </>
    )
  }

  if (isAchievementsSurface) {
    return (
      <>
        <Achievements
          achievements={achievementPresentations}
          onClose={() => send({ type: "ACHIEVEMENTS.CLOSE_REQUESTED" })}
        />
        {achievementBanner}
      </>
    )
  }

  if (state.matches("DataManagement")) {
    return (
      <DataManagement
        activity={dataManagementActivity}
        customValueCount={battleProfile.activeDeck.customValues.length}
        issue={state.context.portabilityIssue}
        notice={state.context.portabilityNotice}
        preview={state.context.pendingImport?.preview ?? null}
        resetReview={state.context.pendingResetReview}
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
        onConfirmReset={handleResetConfirmed}
        onExport={() => send({ type: "DATA_MANAGEMENT.EXPORT_REQUESTED" })}
        onImportFile={(file) => void handleImportFile(file)}
        onRequestReset={handleResetRequested}
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
      <Crucible
        activeDeck={battleProfile.activeDeck}
        achievement={pendingAchievementPresentation}
        battle={presentedBattle}
        progressById={battleProfile.progressById}
        canUndo={battleProfile.history.length > 0}
        canRedo={battleProfile.redo.length > 0}
        isAchievementAcknowledgementPending={isRecordingAchievementPresentation}
        isPersistencePending={!isBattleReady}
        onAchievementPresented={handleAchievementPresented}
        onExit={() => send({ type: "BATTLE.EXIT_REQUESTED" })}
        onUndo={() => send({ type: "BATTLE.UNDO_REQUESTED" })}
        onRedo={() => send({ type: "BATTLE.REDO_REQUESTED" })}
        onWinnerSelected={handleWinnerSelected}
      />
    )
  }

  return null
}

export default function GameClient() {
  const durableStore = useMemo(() => createIndexedDbDurableStore(), [])
  const writerLease = useWebExclusiveWriterLease()

  if (writerLease.status === "checking") return <PlayerDataLoading />
  if (writerLease.status === "read-only")
    return <ReadOnlyGameClient durableStore={durableStore} />

  return <WritableGameClient durableStore={durableStore} />
}
