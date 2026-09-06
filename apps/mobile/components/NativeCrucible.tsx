import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { SeethingSwarmRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import type { ValueId } from "@game/data/src/Value"
import type { ValueProgressById } from "@game/data/src/ValueProgress"
import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import {
  createPendingBattleAccessibilityAction,
  getBattleAccessibilityAnnouncement,
  type PendingBattleAccessibilityAction,
} from "@game/machines/src/BattleAccessibilityPresentation"
import { getBattleRewardPresentation } from "@game/machines/src/BattleRewardPresentation"
import type { BattleSchedulerRestorePoint } from "@game/machines/src/BattleScheduler"
import {
  combatMachine,
  type PresentedBattle,
} from "@game/machines/src/CombatMachine"
import type { ControlHintPreference } from "@game/machines/src/PlayerSettings"
import { getValueChoiceControlHint } from "@game/machines/src/PlayerSettingsPresentation"
import { getLevelFromXP } from "@game/utils/src/LevelMath"
import { useMachine } from "@xstate/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { AccessibilityInfo, View } from "react-native"
import MapacheScreen from "@/components/MapacheScreen"
import NativeAchievementBanner from "@/components/NativeAchievementBanner"
import NativeBattleActionBar from "@/components/NativeBattleActionBar"
import NativeSeethingSwarmBattleStage from "@/components/NativeSeethingSwarmBattleStage"
import NativeValueChoiceCard from "@/components/NativeValueChoiceCard"
import { Text } from "@/components/ui/text"

const NATIVE_CONTROL_HINT_INPUT_MODALITY = "touch-pointer" as const

export default function NativeCrucible({
  activeDeck,
  achievement,
  battle,
  runtimeClipCatalog,
  progressById,
  canUndo,
  canRedo,
  controlHintPreference,
  isAchievementAcknowledgementPending,
  isMenuOpen,
  isPersistencePending,
  shouldReduceMotion,
  onAchievementPresented,
  onExit,
  onOpenMenu,
  onUndo,
  onRedo,
  onWinnerSelected,
}: {
  activeDeck: ActiveDeck
  achievement: AchievementPresentation | null
  battle: PresentedBattle
  runtimeClipCatalog: SeethingSwarmRuntimeClipCatalog<number>
  progressById: ValueProgressById
  canUndo: boolean
  canRedo: boolean
  controlHintPreference: ControlHintPreference
  isAchievementAcknowledgementPending: boolean
  isMenuOpen: boolean
  isPersistencePending: boolean
  shouldReduceMotion: boolean
  onAchievementPresented: (achievementId: AchievementPresentation["id"]) => void
  onExit: () => void
  onOpenMenu: () => void
  onUndo: () => void
  onRedo: () => void
  onWinnerSelected: (
    winnerId: ValueId,
    expectedScheduler: BattleSchedulerRestorePoint,
  ) => void
}) {
  const [state, send] = useMachine(combatMachine, {
    input: { onWinnerSelected },
  })
  const firstChoiceRef = useRef<View>(null)
  const pendingAccessibilityActionRef =
    useRef<PendingBattleAccessibilityAction | null>(null)
  const [rewardAction, setRewardAction] =
    useState<PendingBattleAccessibilityAction | null>(null)

  useEffect(() => {
    send({ type: "BATTLE.PROJECTED", battle })
  }, [battle, send])

  const isInteractive =
    state.matches("AwaitingInput") && !isMenuOpen && !isPersistencePending
  const isAnimating = state.matches("AnimatingResult")
  const currentBattle = state.context.currentBattle
  const currentPair = currentBattle?.pair ?? null
  const handleSelect = useCallback(
    (winnerId: ValueId) => {
      if (!isInteractive || pendingAccessibilityActionRef.current) return

      pendingAccessibilityActionRef.current =
        createPendingBattleAccessibilityAction({
          action: { kind: "selection", selectedValueId: winnerId },
          progressById,
        })
      setRewardAction(pendingAccessibilityActionRef.current)
      send({ type: "VALUE.WINNER_SELECTED", valueId: winnerId })
    },
    [isInteractive, progressById, send],
  )
  const handleUndo = useCallback(() => {
    if (!isInteractive || !canUndo || pendingAccessibilityActionRef.current)
      return

    pendingAccessibilityActionRef.current =
      createPendingBattleAccessibilityAction({
        action: { kind: "undo" },
        progressById,
      })
    onUndo()
  }, [canUndo, isInteractive, onUndo, progressById])
  const handleRedo = useCallback(() => {
    if (!isInteractive || !canRedo || pendingAccessibilityActionRef.current)
      return

    pendingAccessibilityActionRef.current =
      createPendingBattleAccessibilityAction({
        action: { kind: "redo" },
        progressById,
      })
    onRedo()
  }, [canRedo, isInteractive, onRedo, progressById])
  const handleAnimationComplete = useCallback(() => {
    if (isAnimating) send({ type: "ANIMATION.RESULT_FINISHED" })
  }, [isAnimating, send])

  useEffect(() => {
    const pendingAction = pendingAccessibilityActionRef.current
    if (
      !pendingAction ||
      !currentPair ||
      currentBattle !== battle ||
      !isInteractive
    )
      return

    const message = getBattleAccessibilityAnnouncement({
      pendingAction,
      activeDeck,
      progressById,
      pair: currentPair,
    })
    if (!message) return

    const firstChoice = firstChoiceRef.current
    if (!firstChoice)
      throw new Error("First native value choice is unavailable")

    pendingAccessibilityActionRef.current = null
    AccessibilityInfo.sendAccessibilityEvent(firstChoice, "focus")
    AccessibilityInfo.announceForAccessibilityWithOptions(message, {
      queue: true,
    })
  }, [
    activeDeck,
    battle,
    currentBattle,
    currentPair,
    isInteractive,
    progressById,
  ])

  if (!currentBattle || !currentPair) {
    return (
      <MapacheScreen className="items-center justify-center px-6">
        <Text
          accessibilityLiveRegion="polite"
          variant="h1"
          className="text-mapache-vivid-primary-cyan text-4xl uppercase"
        >
          Forging Matrix…
        </Text>
      </MapacheScreen>
    )
  }

  const [firstValueId, secondValueId] = currentPair
  const firstValue = activeDeck.values.find(({ id }) => id === firstValueId)
  const secondValue = activeDeck.values.find(({ id }) => id === secondValueId)
  const firstProgress = progressById.get(firstValueId)
  const secondProgress = progressById.get(secondValueId)

  if (!firstValue || !secondValue || !firstProgress || !secondProgress)
    throw new Error("Projected battle is missing Active Deck data")

  const firstControlHint = getValueChoiceControlHint({
    preference: controlHintPreference,
    inputModality: NATIVE_CONTROL_HINT_INPUT_MODALITY,
    position: "first",
  })
  const secondControlHint = getValueChoiceControlHint({
    preference: controlHintPreference,
    inputModality: NATIVE_CONTROL_HINT_INPUT_MODALITY,
    position: "second",
  })
  const reward =
    isAnimating && state.context.pendingBattle && !isPersistencePending
      ? getBattleRewardPresentation({
          pendingAction: rewardAction,
          activeDeck,
          progressById,
        })
      : null

  return (
    <MapacheScreen
      accessibilityLabel="Value battle"
      accessibilityState={{ busy: isPersistencePending }}
    >
      <NativeBattleActionBar
        canOpenMenu={isInteractive}
        canUndo={isInteractive && canUndo}
        canRedo={isInteractive && canRedo}
        canStop={isInteractive}
        onOpenMenu={onOpenMenu}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onStop={onExit}
      />
      <NativeAchievementBanner
        achievement={achievement}
        isAcknowledgementPending={isAchievementAcknowledgementPending}
        placement="battle"
        shouldReduceMotion={shouldReduceMotion}
        onPresented={onAchievementPresented}
      />
      <NativeSeethingSwarmBattleStage
        battle={currentBattle}
        catalog={runtimeClipCatalog}
        winnerId={state.context.winnerId}
        isNextBattleReady={state.context.pendingBattle !== null}
        isPaused={isMenuOpen}
        shouldReduceMotion={shouldReduceMotion}
        onResultComplete={handleAnimationComplete}
      >
        {(combatants) => (
          <>
            <NativeValueChoiceCard
              ref={firstChoiceRef}
              key={`first:${firstValueId}:${secondValueId}`}
              position="first"
              value={firstValue}
              level={getLevelFromXP(firstProgress.totalXp)}
              controlHint={firstControlHint}
              winnerId={state.context.winnerId}
              isEnabled={isInteractive}
              isAnimating={isAnimating}
              combatant={combatants.first}
              reward={reward?.valueId === firstValueId ? reward : null}
              onActivate={handleSelect}
            />
            <NativeValueChoiceCard
              key={`second:${secondValueId}:${firstValueId}`}
              position="second"
              value={secondValue}
              level={getLevelFromXP(secondProgress.totalXp)}
              controlHint={secondControlHint}
              winnerId={state.context.winnerId}
              isEnabled={isInteractive}
              isAnimating={isAnimating}
              combatant={combatants.second}
              reward={reward?.valueId === secondValueId ? reward : null}
              onActivate={handleSelect}
            />
          </>
        )}
      </NativeSeethingSwarmBattleStage>
    </MapacheScreen>
  )
}
