import { SEETHING_SWARM_BATTLE_RESULT_DURATION_MS } from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { SeethingSwarmRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import type { ValueId } from "@game/data/src/Value"
import type { PresentedBattle } from "@game/machines/src/CombatMachine"
import {
  createSeethingSwarmBattleChoreography,
  type SeethingSwarmBattleChoreography,
  type SeethingSwarmBattleCombatantSide,
} from "@game/machines/src/SeethingSwarmBattleChoreography"
import type { StaticImageData } from "next/image"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react"
import SeethingSwarmCombatant from "@/components/SeethingSwarmCombatant"
import SeethingSwarmPlaceholder from "@/components/SeethingSwarmPlaceholder"

type SeethingSwarmBattleStageStyle = CSSProperties & {
  "--battle-result-duration": string
}

function subscribeToDocumentVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

function getIsDocumentHidden() {
  return document.visibilityState === "hidden"
}

function getServerIsDocumentHidden() {
  return false
}

function BattlePlayback({
  choreography,
  winnerId,
  isNextBattleReady,
  shouldReduceMotion,
  onResultComplete,
  children,
}: {
  choreography: SeethingSwarmBattleChoreography<StaticImageData>
  winnerId: ValueId | null
  isNextBattleReady: boolean
  shouldReduceMotion: boolean
  onResultComplete: () => void
  children: (combatants: { first: ReactNode; second: ReactNode }) => ReactNode
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

  const combatants = choreography.combatants.map((combatant) => (
    <div
      aria-hidden="true"
      key={combatant.side}
      className="pointer-events-none relative flex size-28 shrink-0 items-end justify-center"
      data-animal-id={combatant.animalId}
      data-combatant-side={combatant.side}
      data-value-id={combatant.valueId}
    >
      {"clips" in combatant ? (
        <SeethingSwarmCombatant
          combatant={combatant}
          winnerId={winnerId}
          shouldReduceMotion={shouldReduceMotion}
          onPlaybackComplete={() => handlePlaybackComplete(combatant.side)}
        />
      ) : (
        <SeethingSwarmPlaceholder
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
    </div>
  ))
  return children({ first: combatants[0], second: combatants[1] })
}

export default function SeethingSwarmBattleStage({
  battle,
  isNextBattleReady,
  isPaused = false,
  runtimeClipCatalog,
  shouldReduceMotion,
  winnerId,
  onResultAnimationComplete,
  children,
}: {
  battle: PresentedBattle
  isNextBattleReady: boolean
  isPaused?: boolean
  runtimeClipCatalog: SeethingSwarmRuntimeClipCatalog<StaticImageData>
  shouldReduceMotion: boolean
  winnerId: ValueId | null
  onResultAnimationComplete: () => void
  children: (combatants: { first: ReactNode; second: ReactNode }) => ReactNode
}) {
  const isDocumentHidden = useSyncExternalStore(
    subscribeToDocumentVisibility,
    getIsDocumentHidden,
    getServerIsDocumentHidden,
  )
  const choreography = useMemo(
    () =>
      createSeethingSwarmBattleChoreography({
        battle,
        catalog: runtimeClipCatalog,
      }),
    [battle, runtimeClipCatalog],
  )
  const stageStyle: SeethingSwarmBattleStageStyle = {
    "--battle-result-duration": `${SEETHING_SWARM_BATTLE_RESULT_DURATION_MS}ms`,
  }

  return (
    <div
      className="relative flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row"
      data-battle-stage-mode={choreography.mode}
      data-battle-stage-state={winnerId ? "resolving" : "awaiting-input"}
      data-choreography-identity={choreography.choreographyIdentity}
      style={stageStyle}
    >
      <BattlePlayback
        key={choreography.choreographyIdentity}
        choreography={choreography}
        winnerId={winnerId}
        isNextBattleReady={isNextBattleReady}
        shouldReduceMotion={shouldReduceMotion || isPaused || isDocumentHidden}
        onResultComplete={onResultAnimationComplete}
      >
        {children}
      </BattlePlayback>
    </div>
  )
}
