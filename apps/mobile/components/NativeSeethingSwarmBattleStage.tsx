import type { SeethingSwarmRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import type { ValueId } from "@game/data/src/Value"
import type { PresentedBattle } from "@game/machines/src/CombatMachine"
import {
  createSeethingSwarmBattleChoreography,
  type SeethingSwarmBattleChoreography,
  type SeethingSwarmBattleCombatantSide,
} from "@game/machines/src/SeethingSwarmBattleChoreography"
import {
  createSeethingSwarmBattleTravel,
  resolveSeethingSwarmPlaceholderRole,
  type SeethingSwarmBattleExchangeCue,
  type SeethingSwarmBattlePoint,
} from "@game/machines/src/SeethingSwarmBattleExchange"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { AppState, View } from "react-native"
import NativeSeethingSwarmBattleTraveler from "@/components/NativeSeethingSwarmBattleTraveler"
import NativeSeethingSwarmCombatant from "@/components/NativeSeethingSwarmCombatant"
import NativeSeethingSwarmPlaceholder from "@/components/NativeSeethingSwarmPlaceholder"

function NativeBattlePlayback({
  choreography,
  winnerId,
  isNextBattleReady,
  shouldReduceMotion,
  onResultComplete,
  children,
}: {
  choreography: SeethingSwarmBattleChoreography<number>
  winnerId: ValueId | null
  isNextBattleReady: boolean
  shouldReduceMotion: boolean
  onResultComplete: () => void
  children: (combatants: { first: ReactNode; second: ReactNode }) => ReactNode
}) {
  const [resultCue, setResultCue] = useState<SeethingSwarmBattleExchangeCue>("approach")
  const [readySides, setReadySides] = useState<ReadonlySet<SeethingSwarmBattleCombatantSide>>(() => new Set())
  const [travel, setTravel] = useState<SeethingSwarmBattlePoint | null>(null)
  const [layoutRevision, setLayoutRevision] = useState(0)
  const firstAnchorRef = useRef<View>(null)
  const secondAnchorRef = useRef<View>(null)
  const cue = winnerId ? resultCue : "introduction"
  const completedSidesRef = useRef(new Set<SeethingSwarmBattleCombatantSide>())
  const hasReportedResultRef = useRef(false)
  const reportResult = useCallback(() => {
    if (!winnerId || !isNextBattleReady || hasReportedResultRef.current) return
    if (!shouldReduceMotion && completedSidesRef.current.size !== 2) return
    hasReportedResultRef.current = true
    onResultComplete()
  }, [isNextBattleReady, onResultComplete, shouldReduceMotion, winnerId])
  useEffect(() => reportResult(), [reportResult])

  const measureTravel = useCallback(() => {
    if (!winnerId || shouldReduceMotion || readySides.size !== 2) return
    let isActive = true
    firstAnchorRef.current?.measureInWindow((firstX, firstY, firstWidth, firstHeight) => {
      secondAnchorRef.current?.measureInWindow((secondX, secondY, secondWidth, secondHeight) => {
        if (!isActive) return
        const firstPoint = { x: firstX + firstWidth / 2, y: firstY + firstHeight / 2 }
        const secondPoint = { x: secondX + secondWidth / 2, y: secondY + secondHeight / 2 }
        const isFirstWinner = choreography.combatants[0].valueId === winnerId
        const nextTravel = createSeethingSwarmBattleTravel({ attacker: isFirstWinner ? firstPoint : secondPoint, defender: isFirstWinner ? secondPoint : firstPoint })
        setTravel(nextTravel)
        if (nextTravel.x === 0 && nextTravel.y === 0) setResultCue((current) => current === "approach" ? "strike" : current)
      })
    })
    return () => { isActive = false }
  }, [choreography, readySides, shouldReduceMotion, winnerId])
  useEffect(() => measureTravel(), [layoutRevision, measureTravel])

  const handlePlaybackComplete = (side: SeethingSwarmBattleCombatantSide) => {
    if (cue === "strike") {
      if (choreography.combatants.find((combatant) => combatant.side === side)?.valueId === winnerId) setResultCue("impact")
      return
    }
    if (cue !== "impact") return
    completedSidesRef.current.add(side)
    reportResult()
  }

  const handleReady = (side: SeethingSwarmBattleCombatantSide) => {
    if (cue !== "approach") return
    setReadySides((previous) => previous.has(side) ? previous : new Set([...previous, side]))
  }

  const combatants = choreography.combatants.map((combatant) => (
        <View
          key={combatant.side}
          ref={combatant.side === "first" ? firstAnchorRef : secondAnchorRef}
          accessibilityElementsHidden
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          collapsable={false}
          testID={`battle-combatant-${combatant.side}`}
          className="size-28 items-center justify-end"
        >
          <NativeSeethingSwarmBattleTraveler
            cue={cue}
            travel={combatant.valueId === winnerId ? travel : null}
            shouldReduceMotion={shouldReduceMotion}
            onApproachComplete={() => setResultCue("strike")}
          >
          {"clips" in combatant ? (
            <NativeSeethingSwarmCombatant
              key={cue}
              combatant={combatant}
              winnerId={winnerId}
              cue={cue}
              shouldReduceMotion={shouldReduceMotion}
              onPlaybackComplete={() => handlePlaybackComplete(combatant.side)}
              onReady={() => handleReady(combatant.side)}
            />
          ) : (
            <NativeSeethingSwarmPlaceholder
              key={cue}
              side={combatant.side}
              role={resolveSeethingSwarmPlaceholderRole(cue, winnerId === combatant.valueId)}
              shouldReduceMotion={shouldReduceMotion}
              onPlaybackComplete={() => handlePlaybackComplete(combatant.side)}
              onReady={() => handleReady(combatant.side)}
            />
          )}
          </NativeSeethingSwarmBattleTraveler>
        </View>
      ))
  return (
    <View testID="seething-swarm-battle-stage" onLayout={() => setLayoutRevision((revision) => revision + 1)} className="min-h-0 flex-1 flex-col gap-2 px-3 pb-3 xl:flex-row">
      {children({ first: combatants[0], second: combatants[1] })}
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
  children,
}: {
  battle: PresentedBattle
  catalog: SeethingSwarmRuntimeClipCatalog<number>
  winnerId: ValueId | null
  isNextBattleReady: boolean
  isPaused: boolean
  shouldReduceMotion: boolean
  onResultComplete: () => void
  children: (combatants: { first: ReactNode; second: ReactNode }) => ReactNode
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
      <NativeBattlePlayback
        key={choreography.choreographyIdentity}
        choreography={choreography}
        winnerId={winnerId}
        isNextBattleReady={isNextBattleReady}
        shouldReduceMotion={shouldReduceMotion || isPaused || !isForeground}
        onResultComplete={onResultComplete}
      >{children}</NativeBattlePlayback>
  )
}
