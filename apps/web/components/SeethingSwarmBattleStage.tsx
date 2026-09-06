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
}: {
  choreography: SeethingSwarmBattleChoreography<StaticImageData>
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

  return choreography.combatants.map((combatant, index) => (
    <div
      key={combatant.side}
      className={`row-start-1 flex min-w-0 flex-col items-center justify-end self-stretch ${combatant.side === "first" ? "col-start-1" : "col-start-3"}`}
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
      <span className="mt-1 border-2 border-white bg-black px-2 py-0.5 text-center text-xs leading-none font-black text-white xl:mt-2 xl:text-base">
        {index + 1}
      </span>
    </div>
  ))
}

export default function SeethingSwarmBattleStage({
  battle,
  isNextBattleReady,
  isPaused = false,
  runtimeClipCatalog,
  shouldReduceMotion,
  winnerId,
  onResultAnimationComplete,
}: {
  battle: PresentedBattle
  isNextBattleReady: boolean
  isPaused?: boolean
  runtimeClipCatalog: SeethingSwarmRuntimeClipCatalog<StaticImageData>
  shouldReduceMotion: boolean
  winnerId: ValueId | null
  onResultAnimationComplete: () => void
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
      aria-hidden="true"
      className="bg-mapache-vivid-dark relative grid h-[clamp(7rem,20dvh,11rem)] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 overflow-hidden border-b-8 border-black px-2 pt-2 text-white xl:col-span-2 xl:col-start-1 xl:row-start-2 xl:h-52 xl:gap-8 xl:border-t-8 xl:border-b-0 xl:px-10 xl:pt-4"
      data-battle-stage-mode={choreography.mode}
      data-battle-stage-state={winnerId ? "resolving" : "awaiting-input"}
      data-choreography-identity={choreography.choreographyIdentity}
      style={stageStyle}
    >
      <BattlePlayback
        key={`${choreography.choreographyIdentity}:${winnerId ?? "awaiting"}`}
        choreography={choreography}
        winnerId={winnerId}
        isNextBattleReady={isNextBattleReady}
        shouldReduceMotion={shouldReduceMotion || isPaused || isDocumentHidden}
        onResultComplete={onResultAnimationComplete}
      />
      <span className="col-start-2 row-start-1 self-center border-4 border-white bg-black px-2 py-1 text-sm font-black uppercase shadow-[3px_3px_0px_0px_#ffffff] xl:px-3 xl:py-2 xl:text-xl">
        VS
      </span>
    </div>
  )
}
