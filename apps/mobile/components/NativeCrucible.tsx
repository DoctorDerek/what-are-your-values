import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import type { ValueProgressById } from "@game/data/src/ValueProgress"
import type { BattleSchedulerRestorePoint } from "@game/machines/src/BattleScheduler"
import {
  combatMachine,
  type PresentedBattle,
} from "@game/machines/src/CombatMachine"
import { getLevelFromXP } from "@game/utils/src/LevelMath"
import { useMachine } from "@xstate/react"
import { useCallback, useEffect } from "react"
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native"
import MapacheScreen from "@/components/MapacheScreen"
import NativeBattleActionBar from "@/components/NativeBattleActionBar"
import NativeValueChoiceCard from "@/components/NativeValueChoiceCard"
import { mapacheColors, mapacheSpacing } from "@/theme/MapacheVividTheme"

const WIDE_BATTLE_MINIMUM_WIDTH = 900

export default function NativeCrucible({
  activeDeck,
  battle,
  canRedo,
  canUndo,
  isPersistencePending,
  onExit,
  onRedo,
  onUndo,
  onWinnerSelected,
  progressById,
}: {
  readonly activeDeck: ActiveDeck
  readonly battle: PresentedBattle
  readonly canRedo: boolean
  readonly canUndo: boolean
  readonly isPersistencePending: boolean
  readonly onExit: () => void
  readonly onRedo: () => void
  readonly onUndo: () => void
  readonly onWinnerSelected: (
    winnerId: ValueId,
    expectedScheduler: BattleSchedulerRestorePoint,
  ) => void
  readonly progressById: ValueProgressById
}) {
  const { width } = useWindowDimensions()
  const [state, send] = useMachine(combatMachine, {
    input: { onWinnerSelected },
  })

  useEffect(() => {
    send({ type: "BATTLE.PROJECTED", battle })
  }, [battle, send])

  const isInteractive = state.matches("AwaitingInput") && !isPersistencePending
  const isAnimating = state.matches("AnimatingResult")
  const handleSelect = useCallback(
    (winnerId: ValueId) => {
      if (isInteractive) {
        send({ type: "VALUE.WINNER_SELECTED", valueId: winnerId })
      }
    },
    [isInteractive, send],
  )
  const handleResultAnimationComplete = useCallback(() => {
    if (isAnimating) {
      send({ type: "ANIMATION.RESULT_FINISHED" })
    }
  }, [isAnimating, send])
  const currentPair = state.context.currentBattle?.pair ?? null

  if (!currentPair) {
    return (
      <MapacheScreen>
        <View style={styles.loading}>
          <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
            Forging Matrix…
          </Text>
        </View>
      </MapacheScreen>
    )
  }

  const [firstValueId, secondValueId] = currentPair
  const firstValue = activeDeck.values.find(({ id }) => id === firstValueId)
  const secondValue = activeDeck.values.find(({ id }) => id === secondValueId)
  const firstProgress = progressById.get(firstValueId)
  const secondProgress = progressById.get(secondValueId)

  if (!firstValue || !secondValue || !firstProgress || !secondProgress) {
    throw new Error("Projected battle is missing Active Deck data")
  }

  return (
    <MapacheScreen>
      <View
        accessibilityLabel="Value battle"
        accessibilityState={{ busy: isPersistencePending }}
        style={styles.container}
      >
        <NativeBattleActionBar
          canRedo={isInteractive && canRedo}
          canStop={isInteractive}
          canUndo={isInteractive && canUndo}
          onRedo={onRedo}
          onStop={onExit}
          onUndo={onUndo}
        />
        <ScrollView
          alwaysBounceVertical={false}
          contentContainerStyle={[
            styles.cards,
            width >= WIDE_BATTLE_MINIMUM_WIDTH
              ? styles.wideCards
              : styles.narrowCards,
          ]}
        >
          <NativeValueChoiceCard
            completionOwner
            isAnimating={isAnimating}
            isEnabled={isInteractive}
            level={getLevelFromXP(firstProgress.totalXp)}
            onActivate={handleSelect}
            onResultAnimationComplete={handleResultAnimationComplete}
            position="first"
            value={firstValue}
            winnerId={state.context.winnerId}
          />
          <NativeValueChoiceCard
            completionOwner={false}
            isAnimating={isAnimating}
            isEnabled={isInteractive}
            level={getLevelFromXP(secondProgress.totalXp)}
            onActivate={handleSelect}
            onResultAnimationComplete={handleResultAnimationComplete}
            position="second"
            value={secondValue}
            winnerId={state.context.winnerId}
          />
        </ScrollView>
      </View>
    </MapacheScreen>
  )
}

const styles = StyleSheet.create({
  cards: {
    flexGrow: 1,
    gap: mapacheSpacing.standard,
    paddingBottom: mapacheSpacing.standard,
  },
  container: {
    flex: 1,
    gap: mapacheSpacing.standard,
  },
  loading: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: mapacheColors.white,
    fontSize: 38,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
  },
  narrowCards: {
    flexDirection: "column",
  },
  wideCards: {
    flexDirection: "row",
  },
})
