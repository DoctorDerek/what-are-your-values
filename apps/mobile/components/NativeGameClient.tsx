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
import { BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY } from "@game/machines/src/BattleProfileStore"
import {
  projectBattlePair,
  type BattleSchedulerRestorePoint,
} from "@game/machines/src/BattleScheduler"
import {
  DELETE_ALL_DATA_ACKNOWLEDGMENT,
  type PlayerDataResetKind,
  type PlayerDataResetReview,
} from "@game/machines/src/PlayerDataReset"
import { resolveShouldReduceMotion } from "@game/machines/src/PlayerSettingsPresentation"
import { rootMachine } from "@game/machines/src/RootMachine"
import { useMachine } from "@xstate/react"
import * as ExpoCrypto from "expo-crypto"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AppState, View } from "react-native"
import { useReducedMotion } from "react-native-reanimated"
import NativeAchievementBanner from "@/components/NativeAchievementBanner"
import NativeAchievements from "@/components/NativeAchievements"
import NativeAllValues from "@/components/NativeAllValues"
import NativeControls from "@/components/NativeControls"
import NativeCrucible from "@/components/NativeCrucible"
import NativeDataManagement, {
  type NativeDataManagementActivity,
} from "@/components/NativeDataManagement"
import NativeHub from "@/components/NativeHub"
import { ReopenedNativeInformationPanel } from "@/components/NativeInformationPanel"
import NativeInformationPanelContent from "@/components/NativeInformationPanelContent"
import NativeIntroduction from "@/components/NativeIntroduction"
import NativePersistenceFailure, {
  type NativePlayerDataRecoveryActivity,
} from "@/components/NativePersistenceFailure"
import NativePlayerDataLoading from "@/components/NativePlayerDataLoading"
import NativeProductMenu from "@/components/NativeProductMenu"
import useNativePlayerDataFiles from "@/components/useNativePlayerDataFiles"
import { expoDurableStore } from "@/lib/ExpoDurableStore"
import { createNativeAppLifecycleEvent } from "@/lib/NativeAppLifecycleEvents"
import packageMetadata from "@/package.json"

const nativeRootMachineInput = Object.freeze({
  durableStore: expoDurableStore,
  appVersion: packageMetadata.version,
  sourceBuild: process.env.EXPO_PUBLIC_SOURCE_BUILD ?? "development",
  now: () => new Date().toISOString(),
  randomUuid: () => ExpoCrypto.randomUUID(),
})

export default function NativeGameClient() {
  const [schedulerSeed] = useState(() => ExpoCrypto.randomUUID())
  const systemShouldReduceMotion = useReducedMotion()
  const [isProductMenuOpen, setIsProductMenuOpen] = useState(false)
  const [isControlsOpen, setIsControlsOpen] = useState(false)
  const [activeInformationPanelId, setActiveInformationPanelId] =
    useState<InformationPanelId | null>(null)
  const [pendingAllValuesValueId, setPendingAllValuesValueId] =
    useState<ValueId | null>(null)
  const [shouldOpenCustomValueBuilder, setShouldOpenCustomValueBuilder] =
    useState(false)
  const [customValueBuilderRequestId, setCustomValueBuilderRequestId] =
    useState(0)
  const [state, send] = useMachine(rootMachine, {
    input: nativeRootMachineInput,
  })
  const { isReadingImportFile, chooseBackup } = useNativePlayerDataFiles({
    state,
    send,
  })
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
  const handleAchievementPresented = useCallback(
    (achievementId: AchievementPresentation["id"]) => {
      send({ type: "ACHIEVEMENT.PRESENTED", achievementId })
    },
    [send],
  )
  const openAllValues = useCallback(
    ({
      valueId = null,
      openCustomValueBuilder = false,
    }: {
      readonly valueId?: ValueId | null
      readonly openCustomValueBuilder?: boolean
    }) => {
      setPendingAllValuesValueId(valueId)
      setShouldOpenCustomValueBuilder(openCustomValueBuilder)
      if (openCustomValueBuilder)
        setCustomValueBuilderRequestId((requestId) => requestId + 1)
      send({ type: "ALL_VALUES.OPEN_REQUESTED" })
    },
    [send],
  )
  const handleAddCustomValue = useCallback(
    (name: string, definition: string) => {
      setShouldOpenCustomValueBuilder(false)
      send({ type: "ALL_VALUES.ADD_REQUESTED", name, definition })
    },
    [send],
  )
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
      if (state.matches("Crucible")) send({ type: "BATTLE.EXIT_REQUESTED" })
      if (state.matches("Achievements"))
        send({ type: "ACHIEVEMENTS.CLOSE_REQUESTED" })
      if (state.matches("AllValues"))
        send({ type: "ALL_VALUES.CLOSE_REQUESTED" })
      if (state.matches("DataManagement"))
        send({ type: "DATA_MANAGEMENT.CLOSE_REQUESTED" })
      const destinationActions = {
        "browse-all-values": () => openAllValues({}),
        "custom-values": () => openAllValues({ openCustomValueBuilder: true }),
        achievements: () => send({ type: "ACHIEVEMENTS.OPEN_REQUESTED" }),
        "import-export": () => send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" }),
      } satisfies Record<
        Exclude<ProductMenuRouteDestination["id"], "controls">,
        () => void
      >

      destinationActions[destination.id]()
    },
    [openAllValues, send, state],
  )
  const closeInformationPanel = useCallback(
    () => setActiveInformationPanelId(null),
    [],
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
    send({ type: "APP.HYDRATED", schedulerSeed })
  }, [schedulerSeed, send])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (appState) => {
      const event = createNativeAppLifecycleEvent(appState)
      if (event) {
        setIsProductMenuOpen(false)
        send(event)
      }
    })

    return () => subscription.remove()
  }, [send])

  if (
    state.matches("Hydrating") ||
    state.matches("LoadingProfile") ||
    state.matches("InitializingProfile")
  )
    return <NativePlayerDataLoading />

  if (state.matches("PersistenceFailure")) {
    const recoveryActivity: NativePlayerDataRecoveryActivity | null =
      isReadingImportFile ||
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
    const issue =
      state.context.portabilityIssue ?? state.context.persistenceIssue
    const hasRecoveryEntries = state.context.recoveryEntries !== null
    const canReturnWithoutNewChanges =
      state.context.persistenceFailureOrigin === "initialization" ||
      state.context.persistenceFailureOrigin === "crucible" ||
      state.context.persistenceFailureOrigin === "achievement-presentation"

    if (hasRecoveryEntries)
      return (
        <NativePersistenceFailure
          mode="unreadable-data"
          activity={recoveryActivity}
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
          onImportBackup={() => void chooseBackup("recovery")}
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

    return (
      <NativePersistenceFailure
        mode="storage-unavailable"
        activity={recoveryActivity}
        canExportCurrentData={canExportCurrentData}
        canReturnWithoutNewChanges={canReturnWithoutNewChanges}
        issue={issue}
        notice={state.context.portabilityNotice}
        onExportCurrentData={() =>
          send({ type: "STORAGE_RECOVERY.EXPORT_REQUESTED" })
        }
        onTryAgain={() => send({ type: "STORAGE_RECOVERY.RETRY_REQUESTED" })}
        onReturnWithoutNewChanges={() =>
          send({ type: "STORAGE_RECOVERY.RETURN_REQUESTED" })
        }
      />
    )
  }

  if (state.matches("Splash"))
    return (
      <NativeIntroduction
        notice={state.context.portabilityNotice}
        onComplete={() => send({ type: "INTRODUCTION.COMPLETED" })}
      />
    )

  if (!playerData || !battleProfile || !presentedBattle)
    throw new Error("Battle profile is unavailable after hydration")

  const shouldReduceMotion = resolveShouldReduceMotion(
    playerData.settings.reducedMotion,
    systemShouldReduceMotion,
  )

  const isRecordingAchievementPresentation = state.matches(
    "RecordingAchievementPresentation",
  )
  const isBackgroundCheckpointing = state.matches("BackgroundCheckpointing")
  const achievementPresentationReturnTarget =
    state.context.achievementPresentationReturnTarget
  const backgroundCheckpointReturnTarget =
    state.context.backgroundCheckpointReturnTarget
  const isHubSurface =
    state.matches("Hub") ||
    (isRecordingAchievementPresentation &&
      achievementPresentationReturnTarget === "hub") ||
    (isBackgroundCheckpointing && backgroundCheckpointReturnTarget === "hub")
  const isAchievementsSurface =
    state.matches("Achievements") ||
    (isRecordingAchievementPresentation &&
      achievementPresentationReturnTarget === "achievements") ||
    (isBackgroundCheckpointing &&
      backgroundCheckpointReturnTarget === "achievements")
  const isDataManagementSurface =
    state.matches("DataManagement") ||
    (isBackgroundCheckpointing &&
      backgroundCheckpointReturnTarget === "data-management")
  const isAllValuesSurface =
    state.matches("AllValues") ||
    (isBackgroundCheckpointing &&
      backgroundCheckpointReturnTarget === "all-values")
  const isCrucibleSurface =
    state.matches("Crucible") ||
    (isRecordingAchievementPresentation &&
      achievementPresentationReturnTarget === "crucible") ||
    (isBackgroundCheckpointing &&
      backgroundCheckpointReturnTarget === "crucible")
  const achievementBanner = (
    <NativeAchievementBanner
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
    <ReopenedNativeInformationPanel
      accessibleCloseLabel={activeInformationPanel.accessibleCloseLabel}
      open
      primaryActionLabel={activeInformationPanel.primaryActionLabel}
      title={activeInformationPanel.title}
      onOpenChange={(open) => {
        if (!open) closeInformationPanel()
      }}
      onPrimaryAction={closeInformationPanel}
    >
      <NativeInformationPanelContent
        informationPanel={activeInformationPanel}
      />
    </ReopenedNativeInformationPanel>
  ) : null
  const controls = isControlsOpen ? (
    <NativeControls open onOpenChange={setIsControlsOpen} />
  ) : null
  const isProductOverlayOpen =
    isProductMenuOpen || activeInformationPanelId !== null || isControlsOpen

  if (isHubSurface)
    return (
      <View className="flex-1">
        <NativeHub
          rankedValues={rankedValues}
          dataNotice={state.context.portabilityNotice}
          onAddCustomValue={() =>
            openAllValues({ openCustomValueBuilder: true })
          }
          onBrowseAllValues={() => openAllValues({})}
          onOpenAchievements={() =>
            send({ type: "ACHIEVEMENTS.OPEN_REQUESTED" })
          }
          onOpenDataManagement={() =>
            send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
          }
          onOpenMenu={() => setIsProductMenuOpen(true)}
          onOpenValue={(valueId) => openAllValues({ valueId })}
          onStartBattle={() => send({ type: "BATTLE.START_REQUESTED" })}
        />
        <NativeProductMenu
          contextActionLabel={PRODUCT_MENU_COPY.closeAction}
          open={isProductMenuOpen}
          onDestinationSelect={handleProductMenuDestinationSelect}
          onOpenChange={setIsProductMenuOpen}
        />
        {reopenedInformationPanel}
        {controls}
        {achievementBanner}
      </View>
    )

  if (isAchievementsSurface)
    return (
      <View className="flex-1">
        <NativeAchievements
          achievements={achievementPresentations}
          canOpenMenu={state.matches("Achievements")}
          onClose={() => send({ type: "ACHIEVEMENTS.CLOSE_REQUESTED" })}
          onOpenMenu={() => setIsProductMenuOpen(true)}
        />
        <NativeProductMenu
          contextActionLabel={PRODUCT_MENU_COPY.closeAction}
          open={isProductMenuOpen}
          onDestinationSelect={handleProductMenuDestinationSelect}
          onOpenChange={setIsProductMenuOpen}
        />
        {reopenedInformationPanel}
        {controls}
        {achievementBanner}
      </View>
    )

  if (isDataManagementSurface) {
    const activity: NativeDataManagementActivity | null =
      isReadingImportFile ||
      state.matches({ DataManagement: "PreparingImport" })
        ? "Checking backup…"
        : state.matches({ DataManagement: "Exporting" }) ||
            state.matches({ DataManagement: "ExportingResetBackup" })
          ? "Creating backup…"
          : state.matches({ DataManagement: "CreatingPreImportBackup" })
            ? "Creating safety backup…"
            : state.matches({ DataManagement: "ReplacingImport" })
              ? "Restoring backup…"
              : state.matches({ DataManagement: "ApplyingScopedReset" })
                ? "Applying reset…"
                : state.matches({ DataManagement: "DeletingAllData" })
                  ? "Deleting data…"
                  : null

    return (
      <View className="flex-1">
        <NativeDataManagement
          activity={activity}
          customValueCount={battleProfile.activeDeck.customValues.length}
          isNavigationPending={isBackgroundCheckpointing}
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
          onChooseBackup={() => void chooseBackup("data-management")}
          onClose={() => send({ type: "DATA_MANAGEMENT.CLOSE_REQUESTED" })}
          onConfirmImport={() =>
            send({ type: "DATA_MANAGEMENT.IMPORT_CONFIRM_REQUESTED" })
          }
          onConfirmReset={handleResetConfirmed}
          onExport={() => send({ type: "DATA_MANAGEMENT.EXPORT_REQUESTED" })}
          onOpenMenu={() => setIsProductMenuOpen(true)}
          onRequestReset={handleResetRequested}
        />
        <NativeProductMenu
          contextActionLabel={PRODUCT_MENU_COPY.closeAction}
          open={isProductMenuOpen}
          onDestinationSelect={handleProductMenuDestinationSelect}
          onOpenChange={setIsProductMenuOpen}
        />
        {reopenedInformationPanel}
        {controls}
      </View>
    )
  }

  if (isAllValuesSurface)
    return (
      <View className="flex-1">
        <NativeAllValues
          key={`${battleProfile.scheduler.deckRevision}:${customValueBuilderRequestId}`}
          initialValueId={pendingAllValuesValueId}
          isPersistencePending={
            isBackgroundCheckpointing ||
            state.matches({ AllValues: "Persisting" })
          }
          openCustomValueBuilder={shouldOpenCustomValueBuilder}
          persistenceIssue={state.context.persistenceIssue}
          rankedValues={rankedValues}
          onAddCustomValue={handleAddCustomValue}
          onClose={() => send({ type: "ALL_VALUES.CLOSE_REQUESTED" })}
          onDeleteCustomValue={(valueId) =>
            send({ type: "ALL_VALUES.DELETE_REQUESTED", valueId })
          }
          onOpenMenu={() => setIsProductMenuOpen(true)}
          onUpdateCustomValue={handleUpdateCustomValue}
        />
        <NativeProductMenu
          contextActionLabel={PRODUCT_MENU_COPY.closeAction}
          open={isProductMenuOpen}
          onDestinationSelect={handleProductMenuDestinationSelect}
          onOpenChange={setIsProductMenuOpen}
        />
        {reopenedInformationPanel}
        {controls}
      </View>
    )

  if (isCrucibleSurface) {
    const isBattleReady = state.matches({ Crucible: "Ready" })

    return (
      <View className="flex-1">
        <NativeCrucible
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
          onOpenMenu={() => setIsProductMenuOpen(true)}
          onUndo={() => send({ type: "BATTLE.UNDO_REQUESTED" })}
          onRedo={() => send({ type: "BATTLE.REDO_REQUESTED" })}
          onWinnerSelected={handleWinnerSelected}
        />
        <NativeProductMenu
          contextActionLabel={PRODUCT_MENU_COPY.resumeBattleAction}
          open={isProductMenuOpen}
          onDestinationSelect={handleProductMenuDestinationSelect}
          onOpenChange={setIsProductMenuOpen}
        />
        {reopenedInformationPanel}
        {controls}
      </View>
    )
  }

  throw new Error(
    `Unsupported native root state: ${JSON.stringify(state.value)}`,
  )
}
