import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import type { ValueProgressById } from "@game/data/src/ValueProgress"
import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import type { BattleSchedulerRestorePoint } from "@game/machines/src/BattleScheduler"
import {
  combatMachine,
  type PresentedBattle,
} from "@game/machines/src/CombatMachine"
import type { ControlHintPreference } from "@game/machines/src/PlayerSettings"
import { getValueChoiceControlHint } from "@game/machines/src/PlayerSettingsPresentation"
import { getLevelFromXP } from "@game/utils/src/LevelMath"
import { useMachine } from "@xstate/react"
import { useCallback, useEffect } from "react"
import { View } from "react-native"
import MapacheScreen from "@/components/MapacheScreen"
import NativeAchievementBanner from "@/components/NativeAchievementBanner"
import NativeBattleActionBar from "@/components/NativeBattleActionBar"
import NativeValueChoiceCard from "@/components/NativeValueChoiceCard"
import { Text } from "@/components/ui/text"

const NATIVE_CONTROL_HINT_INPUT_MODALITY = "touch-pointer" as const

export default function NativeCrucible({
  activeDeck,
  achievement,
  battle,
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

  useEffect(() => {
    send({ type: "BATTLE.PROJECTED", battle })
  }, [battle, send])

  const isInteractive =
    state.matches("AwaitingInput") && !isMenuOpen && !isPersistencePending
  const isAnimating = state.matches("AnimatingResult")
  const currentPair = state.context.currentBattle?.pair ?? null
  const handleSelect = useCallback(
    (winnerId: ValueId) => {
      if (!isInteractive) return
      send({ type: "VALUE.WINNER_SELECTED", valueId: winnerId })
    },
    [isInteractive, send],
  )
  const handleAnimationComplete = useCallback(() => {
    if (isAnimating) send({ type: "ANIMATION.RESULT_FINISHED" })
  }, [isAnimating, send])

  if (!currentPair) {
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
        onUndo={onUndo}
        onRedo={onRedo}
        onStop={onExit}
      />
      <NativeAchievementBanner
        achievement={achievement}
        isAcknowledgementPending={isAchievementAcknowledgementPending}
        placement="battle"
        shouldReduceMotion={shouldReduceMotion}
        onPresented={onAchievementPresented}
      />
      <View className="min-h-0 flex-1 flex-col gap-2 px-3 pb-3 xl:flex-row">
        <NativeValueChoiceCard
          key={`first:${firstValueId}:${secondValueId}`}
          position="first"
          value={firstValue}
          level={getLevelFromXP(firstProgress.totalXp)}
          controlHint={firstControlHint}
          winnerId={state.context.winnerId}
          isEnabled={isInteractive}
          isAnimating={isAnimating}
          reportsAnimationCompletion
          shouldReduceMotion={shouldReduceMotion}
          onActivate={handleSelect}
          onAnimationComplete={handleAnimationComplete}
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
          reportsAnimationCompletion={false}
          shouldReduceMotion={shouldReduceMotion}
          onActivate={handleSelect}
          onAnimationComplete={handleAnimationComplete}
        />
      </View>
    </MapacheScreen>
  )
}
