"use client"

import {
  INFORMATION_PANELS,
  type InformationPanelId,
} from "@game/data/src/InformationPanels"
import {
  PRODUCT_MENU_COPY,
  type ProductMenuDestination,
  type ProductMenuRouteDestination,
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
import {
  PLAYER_SETTINGS_COPY,
  resolveShouldReduceMotion,
} from "@game/machines/src/PlayerSettingsPresentation"
import { rootMachine } from "@game/machines/src/RootMachine"
import { getErrorMessage } from "@game/utils/src/Errors"
import { useMachine } from "@xstate/react"
import { useReducedMotion } from "motion/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Controls from "@/components/Controls"
import { ReopenedInformationPanel } from "@/components/InformationPanel"
import InformationPanelContent from "@/components/InformationPanelContent"
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
import Settings from "./Settings"
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
  const systemShouldReduceMotion = useReducedMotion() === true
  const browseAllValuesButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusTargetIdRef = useRef("hub-browse-all-values-button")
  const [pendingAllValuesValueId, setPendingAllValuesValueId] =
    useState<ValueId | null>(null)
  const [shouldOpenCustomValueBuilder, setShouldOpenCustomValueBuilder] =
    useState(false)
  const [customValueBuilderRequestId, setCustomValueBuilderRequestId] =
    useState(0)
  const shouldRestoreHubFocusRef = useRef(false)
  const deliveredDownloadsRef = useRef(new WeakSet<object>())
  const [isReadingImportFile, setIsReadingImportFile] = useState(false)
  const [isReadingRecoveryImportFile, setIsReadingRecoveryImportFile] =
    useState(false)
  const [isProductMenuOpen, setIsProductMenuOpen] = useState(false)
  const [isControlsOpen, setIsControlsOpen] = useState(false)
  const [activeInformationPanelId, setActiveInformationPanelId] =
    useState<InformationPanelId | null>(null)
  const productMenuReturnFocusTargetRef = useRef<HTMLElement | null>(null)
  const playerData = state.context.playerData
  const shouldReduceMotion = playerData
    ? resolveShouldReduceMotion(
        playerData.settings.reducedMotion,
        systemShouldReduceMotion,
      )
    : systemShouldReduceMotion
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
      if (openCustomValueBuilder)
        setCustomValueBuilderRequestId((requestId) => requestId + 1)
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
  const handleProductMenuOpen = useCallback(() => {
    const activeElement = document.activeElement
    productMenuReturnFocusTargetRef.current =
      activeElement instanceof HTMLElement ? activeElement : null
    setIsProductMenuOpen(true)
  }, [])
  const closeInformationPanel = useCallback(
    () => setActiveInformationPanelId(null),
    [],
  )
  const handleInformationPanelCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault()
    productMenuReturnFocusTargetRef.current?.focus()
  }, [])
  const handleProductMenuDestinationSelect = useCallback(
    (destination: ProductMenuDestination) => {
      setIsProductMenuOpen(false)
      if (destination.kind === "information-panel") {
        setActiveInformationPanelId(destination.id)
        return
      }
      if (destination.id === "controls") {
        setIsControlsOpen(true)
        return
      }
      if (destination.id === "settings") {
        send({ type: "SETTINGS.OPEN_REQUESTED" })
        return
      }
      const settingsReturnTarget = state.matches("Settings")
        ? state.context.settingsReturnTarget
        : null
      if (state.matches("Settings")) send({ type: "SETTINGS.CLOSE_REQUESTED" })
      if (state.matches("Crucible") || settingsReturnTarget === "crucible")
        send({ type: "BATTLE.EXIT_REQUESTED" })
      if (
        state.matches("Achievements") ||
        settingsReturnTarget === "achievements"
      )
        send({ type: "ACHIEVEMENTS.CLOSE_REQUESTED" })
      if (
        state.matches("DataManagement") ||
        settingsReturnTarget === "data-management"
      )
        send({ type: "DATA_MANAGEMENT.CLOSE_REQUESTED" })
      if (state.matches("AllValues") || settingsReturnTarget === "all-values")
        send({ type: "ALL_VALUES.CLOSE_REQUESTED" })
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
      } satisfies Record<
        Exclude<ProductMenuRouteDestination["id"], "controls" | "settings">,
        () => void
      >

      destinationActions[destination.id]()
    },
    [openAchievements, openAllValues, openDataManagement, send, state],
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
    const isDataControlDownload =
      state.matches("DataManagement") || state.matches("Settings")
    const isRecoveryDownload = state.matches("PersistenceFailure")
    if (
      (!isDataControlDownload && !isRecoveryDownload) ||
      !preparedDownload ||
      deliveredDownloadsRef.current.has(preparedDownload)
    )
      return

    deliveredDownloadsRef.current.add(preparedDownload)
    try {
      downloadPlayerDataFile(preparedDownload)
      if (isDataControlDownload)
        send({ type: "DATA_MANAGEMENT.EXPORT_CONSUMED" })
      if (isRecoveryDownload) send({ type: "RECOVERY.EXPORT_CONSUMED" })
    } catch {
      if (isDataControlDownload)
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
  const isBackgroundCheckpointing = state.matches("BackgroundCheckpointing")
  const isSettingsSurface =
    state.matches("Settings") ||
    (isBackgroundCheckpointing &&
      state.context.backgroundCheckpointReturnTarget === "settings")
  const settingsActivity =
    state.matches({ Settings: "Persisting" }) || isBackgroundCheckpointing
      ? PLAYER_SETTINGS_COPY.savingStatus
      : state.matches({ Settings: "ExportingResetBackup" })
        ? "Creating backup…"
        : state.matches({ Settings: "ApplyingScopedReset" })
          ? "Applying reset…"
          : state.matches({ Settings: "DeletingAllData" })
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

  if (!playerData || !battleProfile || !presentedBattle) {
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
      shouldReduceMotion={shouldReduceMotion}
      onPresented={handleAchievementPresented}
    />
  )
  const activeInformationPanel = activeInformationPanelId
    ? INFORMATION_PANELS[activeInformationPanelId]
    : null
  const reopenedInformationPanel = activeInformationPanel ? (
    <ReopenedInformationPanel
      accessibleCloseLabel={activeInformationPanel.accessibleCloseLabel}
      open
      primaryActionLabel={activeInformationPanel.primaryActionLabel}
      title={activeInformationPanel.title}
      onCloseAutoFocus={handleInformationPanelCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open) closeInformationPanel()
      }}
      onPrimaryAction={closeInformationPanel}
    >
      <InformationPanelContent informationPanel={activeInformationPanel} />
    </ReopenedInformationPanel>
  ) : null
  const controls = isControlsOpen ? (
    <Controls
      open
      onCloseAutoFocus={handleInformationPanelCloseAutoFocus}
      onOpenChange={setIsControlsOpen}
    />
  ) : null
  const isProductOverlayOpen =
    isProductMenuOpen || activeInformationPanelId !== null || isControlsOpen
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
          onOpenMenu={handleProductMenuOpen}
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
        {reopenedInformationPanel}
        {controls}
        {achievementBanner}
      </>
    )
  }

  if (isAchievementsSurface) {
    return (
      <>
        <Achievements
          achievements={achievementPresentations}
          canOpenMenu={!isRecordingAchievementPresentation}
          onClose={() => send({ type: "ACHIEVEMENTS.CLOSE_REQUESTED" })}
          onOpenMenu={handleProductMenuOpen}
        />
        <ProductMenu
          contextActionLabel={PRODUCT_MENU_COPY.closeAction}
          open={isProductMenuOpen}
          onDestinationSelect={handleProductMenuDestinationSelect}
          onOpenChange={setIsProductMenuOpen}
        />
        {reopenedInformationPanel}
        {controls}
        {achievementBanner}
      </>
    )
  }

  if (isSettingsSurface) {
    return (
      <>
        <Settings
          activity={settingsActivity}
          customValueCount={battleProfile.activeDeck.customValues.length}
          issue={
            state.context.portabilityIssue ?? state.context.persistenceIssue
          }
          notice={state.context.portabilityNotice}
          resetReview={state.context.pendingResetReview}
          settings={playerData.settings}
          onCancelReset={() =>
            send({ type: "DATA_MANAGEMENT.RESET_CANCEL_REQUESTED" })
          }
          onClose={() => send({ type: "SETTINGS.CLOSE_REQUESTED" })}
          onConfirmReset={handleResetConfirmed}
          onExport={() => send({ type: "DATA_MANAGEMENT.EXPORT_REQUESTED" })}
          onOpenMenu={handleProductMenuOpen}
          onRequestReset={handleResetRequested}
          onUpdateSettings={(settings) =>
            send({ type: "SETTINGS.UPDATE_REQUESTED", settings })
          }
        />
        <ProductMenu
          contextActionLabel={PRODUCT_MENU_COPY.closeAction}
          open={isProductMenuOpen}
          onDestinationSelect={handleProductMenuDestinationSelect}
          onOpenChange={setIsProductMenuOpen}
        />
        {reopenedInformationPanel}
        {controls}
      </>
    )
  }

  if (state.matches("DataManagement")) {
    return (
      <>
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
          onOpenMenu={handleProductMenuOpen}
          onRequestReset={handleResetRequested}
        />
        <ProductMenu
          contextActionLabel={PRODUCT_MENU_COPY.closeAction}
          open={isProductMenuOpen}
          onDestinationSelect={handleProductMenuDestinationSelect}
          onOpenChange={setIsProductMenuOpen}
        />
        {reopenedInformationPanel}
        {controls}
      </>
    )
  }

  if (state.matches("AllValues")) {
    return (
      <>
        <AllValues
          key={`${battleProfile.scheduler.deckRevision}:${customValueBuilderRequestId}`}
          rankedValues={rankedValues}
          initialValueId={pendingAllValuesValueId}
          openCustomValueBuilder={shouldOpenCustomValueBuilder}
          isMenuOpen={isProductOverlayOpen}
          isPersistencePending={state.matches({ AllValues: "Persisting" })}
          persistenceIssue={state.context.persistenceIssue}
          onClose={handleAllValuesClose}
          onAddCustomValue={handleAddCustomValue}
          onUpdateCustomValue={handleUpdateCustomValue}
          onDeleteCustomValue={(valueId) =>
            send({ type: "ALL_VALUES.DELETE_REQUESTED", valueId })
          }
          onOpenMenu={handleProductMenuOpen}
        />
        <ProductMenu
          contextActionLabel={PRODUCT_MENU_COPY.closeAction}
          open={isProductMenuOpen}
          onDestinationSelect={handleProductMenuDestinationSelect}
          onOpenChange={setIsProductMenuOpen}
        />
        {reopenedInformationPanel}
        {controls}
      </>
    )
  }

  if (isCrucibleSurface) {
    const isBattleReady = state.matches({ Crucible: "Ready" })

    return (
      <>
        <Crucible
          activeDeck={battleProfile.activeDeck}
          achievement={pendingAchievementPresentation}
          battle={presentedBattle}
          progressById={battleProfile.progressById}
          canUndo={battleProfile.history.length > 0}
          canRedo={battleProfile.redo.length > 0}
          controlHintPreference={playerData.settings.controlHints}
          isAchievementAcknowledgementPending={
            isRecordingAchievementPresentation
          }
          isMenuOpen={isProductOverlayOpen}
          isPersistencePending={!isBattleReady}
          shouldReduceMotion={shouldReduceMotion}
          onAchievementPresented={handleAchievementPresented}
          onExit={() => send({ type: "BATTLE.EXIT_REQUESTED" })}
          onOpenMenu={handleProductMenuOpen}
          onUndo={() => send({ type: "BATTLE.UNDO_REQUESTED" })}
          onRedo={() => send({ type: "BATTLE.REDO_REQUESTED" })}
          onWinnerSelected={handleWinnerSelected}
        />
        <ProductMenu
          contextActionLabel={PRODUCT_MENU_COPY.resumeBattleAction}
          open={isProductMenuOpen}
          onDestinationSelect={handleProductMenuDestinationSelect}
          onOpenChange={setIsProductMenuOpen}
        />
        {reopenedInformationPanel}
        {controls}
      </>
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
