import type { ValueId } from "@game/data/src/Value"
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
import { rootMachine } from "@game/machines/src/RootMachine"
import { useMachine } from "@xstate/react"
import * as ExpoCrypto from "expo-crypto"
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import NativeAchievementBanner from "@/components/NativeAchievementBanner"
import NativeCrucible from "@/components/NativeCrucible"
import NativeHub from "@/components/NativeHub"
import NativeIntroduction from "@/components/NativeIntroduction"
import NativePersistenceFailure from "@/components/NativePersistenceFailure"
import NativePlayerDataLoading from "@/components/NativePlayerDataLoading"
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
  const [state, send] = useMachine(rootMachine, {
    input: nativeRootMachineInput,
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
          onStartBattle={() => send({ type: "BATTLE.START_REQUESTED" })}
        />
        {achievementBanner}
      </View>
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
