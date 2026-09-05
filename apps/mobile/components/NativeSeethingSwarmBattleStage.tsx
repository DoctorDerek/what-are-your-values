import type { SeethingSwarmRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import type { ValueId } from "@game/data/src/Value"
import type { PresentedBattle } from "@game/machines/src/CombatMachine"
import {
  createSeethingSwarmBattleChoreography,
  type SeethingSwarmBattleChoreography,
  type SeethingSwarmBattleCombatantSide,
} from "@game/machines/src/SeethingSwarmBattleChoreography"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppState, View } from "react-native"
import NativeSeethingSwarmCombatant from "@/components/NativeSeethingSwarmCombatant"
import NativeSeethingSwarmPlaceholder from "@/components/NativeSeethingSwarmPlaceholder"
import { Text } from "@/components/ui/text"

function NativeBattlePlayback({
  choreography,
  winnerId,
  isNextBattleReady,
  shouldReduceMotion,
  onResultComplete,
}: {
  choreography: SeethingSwarmBattleChoreography<number>
  winnerId: ValueId | null
  isNextBattleReady: boolean
  shouldReduceMotion: boolean
  onResultComplete: () => void
}) {
  const completedSidesRef = useRef(new Set<SeethingSwarmBattleCombatantSide>())
  const hasReportedResultRef = useRef(false)
  const reportResult = useCallback(() => {
    if (!winnerId || !isNextBattleReady || hasReportedResultRef.current) return
    if (!shouldReduceMotion && completedSidesRef.current.size !== 2) return
    hasReportedResultRef.current = true
    onResultComplete()
  }, [isNextBattleReady, onResultComplete, shouldReduceMotion, winnerId])
  useEffect(() => reportResult(), [reportResult])
  const handlePlaybackComplete = (side: SeethingSwarmBattleCombatantSide) => {
    completedSidesRef.current.add(side)
    reportResult()
  }

  return (
    <View className="flex-1 flex-row items-end justify-around">
      {choreography.combatants.map((combatant) => (
        <View
          key={combatant.side}
          testID={`battle-combatant-${combatant.side}`}
          className="items-center"
        >
          <Text className="text-xs font-black text-black">
            {combatant.side === "first" ? "1" : "2"}
          </Text>
          {"clips" in combatant ? (
            <NativeSeethingSwarmCombatant
              combatant={combatant}
              winnerId={winnerId}
              shouldReduceMotion={shouldReduceMotion}
              onPlaybackComplete={() => handlePlaybackComplete(combatant.side)}
            />
          ) : (
            <NativeSeethingSwarmPlaceholder
              side={combatant.side}
              result={
                !winnerId
                  ? null
                  : winnerId === combatant.valueId
                    ? "winner"
                    : "loser"
              }
              shouldReduceMotion={shouldReduceMotion}
              onPlaybackComplete={() => handlePlaybackComplete(combatant.side)}
            />
          )}
        </View>
      ))}
      <View className="absolute inset-x-0 top-2 items-center">
        <Text className="text-sm font-black text-black">VS</Text>
      </View>
    </View>
  )
}

export default function NativeSeethingSwarmBattleStage({
  battle,
  catalog,
  winnerId,
  isNextBattleReady,
  isPaused,
  shouldReduceMotion,
  onResultComplete,
}: {
  battle: PresentedBattle
  catalog: SeethingSwarmRuntimeClipCatalog<number>
  winnerId: ValueId | null
  isNextBattleReady: boolean
  isPaused: boolean
  shouldReduceMotion: boolean
  onResultComplete: () => void
}) {
  const [isForeground, setIsForeground] = useState(
    AppState.currentState === "active",
  )
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setIsForeground(state === "active"),
    )
    return () => subscription.remove()
  }, [])
  const choreography = useMemo(
    () => createSeethingSwarmBattleChoreography({ battle, catalog }),
    [battle, catalog],
  )

  return (
    <View
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="seething-swarm-battle-stage"
      className="bg-mapache-vivid-primary-yellow h-36 shrink-0 overflow-hidden border-4 border-black px-2 pb-1 xl:h-40"
    >
      <NativeBattlePlayback
        key={`${choreography.choreographyIdentity}:${winnerId ?? "awaiting"}`}
        choreography={choreography}
        winnerId={winnerId}
        isNextBattleReady={isNextBattleReady}
        shouldReduceMotion={shouldReduceMotion || isPaused || !isForeground}
        onResultComplete={onResultComplete}
      />
    </View>
  )
}
