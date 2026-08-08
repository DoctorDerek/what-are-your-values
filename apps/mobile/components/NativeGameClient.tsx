import type { CustomValueId, ValueId } from "@game/data/src/Value"
import { rankValues } from "@game/data/src/ValueRanking"
import {
  getPendingAchievementPresentation,
  projectAchievementCatalog,
  type AchievementPresentation,
} from "@game/machines/src/AchievementPresentation"
import {
  projectBattlePair,
  type BattleSchedulerRestorePoint,
} from "@game/machines/src/BattleScheduler"
import {
  DELETE_ALL_DATA_ACKNOWLEDGMENT,
  type PlayerDataResetKind,
  type PlayerDataResetReview,
} from "@game/machines/src/PlayerDataReset"
import { rootMachine } from "@game/machines/src/RootMachine"
import { useMachine } from "@xstate/react"
import * as ExpoCrypto from "expo-crypto"
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import NativeAchievementBanner from "@/components/NativeAchievementBanner"
import NativeAchievements from "@/components/NativeAchievements"
import NativeAllValues from "@/components/NativeAllValues"
import NativeCrucible from "@/components/NativeCrucible"
import NativeDataManagement, {
  type NativeDataManagementActivity,
} from "@/components/NativeDataManagement"
import NativeHub from "@/components/NativeHub"
import NativeIntroduction from "@/components/NativeIntroduction"
import NativePersistenceFailure from "@/components/NativePersistenceFailure"
import NativePlayerDataLoading from "@/components/NativePlayerDataLoading"
import useNativePlayerDataFiles from "@/components/useNativePlayerDataFiles"
import { expoDurableStore } from "@/lib/ExpoDurableStore"
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
  const [pendingAllValuesValueId, setPendingAllValuesValueId] =
    useState<ValueId | null>(null)
  const [shouldOpenCustomValueBuilder, setShouldOpenCustomValueBuilder] =
    useState(false)
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

  if (
    state.matches("Hydrating") ||
    state.matches("LoadingProfile") ||
    state.matches("InitializingProfile")
  )
    return <NativePlayerDataLoading />

  if (state.matches("PersistenceFailure")) {
    const canReturnWithoutNewChanges =
      state.context.persistenceFailureOrigin === "initialization" ||
      state.context.persistenceFailureOrigin === "crucible" ||
      state.context.persistenceFailureOrigin === "achievement-presentation"

    return (
      <NativePersistenceFailure
        hasRecoveryEntries={state.context.recoveryEntries !== null}
        canReturnWithoutNewChanges={canReturnWithoutNewChanges}
        issue={state.context.portabilityIssue ?? state.context.persistenceIssue}
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

  if (!battleProfile || !presentedBattle)
    throw new Error("Battle profile is unavailable after hydration")

  const isRecordingAchievementPresentation = state.matches(
    "RecordingAchievementPresentation",
  )
  const achievementPresentationReturnTarget =
    state.context.achievementPresentationReturnTarget
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
  const achievementBanner = (
    <NativeAchievementBanner
      achievement={pendingAchievementPresentation}
      isAcknowledgementPending={isRecordingAchievementPresentation}
      onPresented={handleAchievementPresented}
    />
  )

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
          onOpenValue={(valueId) => openAllValues({ valueId })}
          onStartBattle={() => send({ type: "BATTLE.START_REQUESTED" })}
        />
        {achievementBanner}
      </View>
    )

  if (isAchievementsSurface)
    return (
      <View className="flex-1">
        <NativeAchievements
          achievements={achievementPresentations}
          onClose={() => send({ type: "ACHIEVEMENTS.CLOSE_REQUESTED" })}
        />
        {achievementBanner}
      </View>
    )

  if (state.matches("DataManagement")) {
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
      <NativeDataManagement
        activity={activity}
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
        onChooseBackup={() => void chooseBackup()}
        onClose={() => send({ type: "DATA_MANAGEMENT.CLOSE_REQUESTED" })}
        onConfirmImport={() =>
          send({ type: "DATA_MANAGEMENT.IMPORT_CONFIRM_REQUESTED" })
        }
        onConfirmReset={handleResetConfirmed}
        onExport={() => send({ type: "DATA_MANAGEMENT.EXPORT_REQUESTED" })}
        onRequestReset={handleResetRequested}
      />
    )
  }

  if (state.matches("AllValues"))
    return (
      <NativeAllValues
        key={battleProfile.scheduler.deckRevision}
        initialValueId={pendingAllValuesValueId}
        isPersistencePending={state.matches({ AllValues: "Persisting" })}
        openCustomValueBuilder={shouldOpenCustomValueBuilder}
        persistenceIssue={state.context.persistenceIssue}
        rankedValues={rankedValues}
        onAddCustomValue={handleAddCustomValue}
        onClose={() => send({ type: "ALL_VALUES.CLOSE_REQUESTED" })}
        onDeleteCustomValue={(valueId) =>
          send({ type: "ALL_VALUES.DELETE_REQUESTED", valueId })
        }
        onUpdateCustomValue={handleUpdateCustomValue}
      />
    )

  if (isCrucibleSurface) {
    const isBattleReady = state.matches({ Crucible: "Ready" })

    return (
      <View className="flex-1">
        <NativeCrucible
          activeDeck={battleProfile.activeDeck}
          battle={presentedBattle}
          progressById={battleProfile.progressById}
          canUndo={battleProfile.history.length > 0}
          canRedo={battleProfile.redo.length > 0}
          hasAchievementBanner={pendingAchievementPresentation !== null}
          isPersistencePending={!isBattleReady}
          onExit={() => send({ type: "BATTLE.EXIT_REQUESTED" })}
          onUndo={() => send({ type: "BATTLE.UNDO_REQUESTED" })}
          onRedo={() => send({ type: "BATTLE.REDO_REQUESTED" })}
          onWinnerSelected={handleWinnerSelected}
        />
        {achievementBanner}
      </View>
    )
  }

  throw new Error(
    `Unsupported native root state: ${JSON.stringify(state.value)}`,
  )
}
