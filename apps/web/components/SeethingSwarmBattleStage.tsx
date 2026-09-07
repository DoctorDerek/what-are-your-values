import {
  SEETHING_SWARM_BATTLE_RESULT_DURATION_MS,
  SEETHING_SWARM_BATTLE_TILE_SIZE,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
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
  SEETHING_SWARM_BATTLE_APPROACH_DURATION_MS,
  type SeethingSwarmBattleExchangeCue,
  type SeethingSwarmBattlePoint,
} from "@game/machines/src/SeethingSwarmBattleExchange"
import { getSeethingSwarmBattleClips } from "@game/machines/src/SeethingSwarmBattlePlayback"
import { motion } from "motion/react"
import type { StaticImageData } from "next/image"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react"
import { preload } from "react-dom"
import SeethingSwarmCombatant from "@/components/SeethingSwarmCombatant"
import SeethingSwarmPlaceholder from "@/components/SeethingSwarmPlaceholder"

type SeethingSwarmBattleStageStyle = CSSProperties & {
  "--battle-result-duration": string
  "--battle-compact-combatant-size": string
  "--battle-compact-combatant-scale": number
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
  children: (combatants: {
    first: (isAttended: boolean, reward?: ReactNode) => ReactNode
    second: (isAttended: boolean, reward?: ReactNode) => ReactNode
  }) => ReactNode
}) {
  const [resultCue, setResultCue] =
    useState<SeethingSwarmBattleExchangeCue>("approach")
  const [readySides, setReadySides] = useState<
    ReadonlySet<SeethingSwarmBattleCombatantSide>
  >(() => new Set())
  const [travel, setTravel] = useState<SeethingSwarmBattlePoint | null>(null)
  const firstAnchorRef = useRef<HTMLDivElement>(null)
  const secondAnchorRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    if (!winnerId || shouldReduceMotion || readySides.size !== 2) return
    const measureTravel = () => {
      const first = firstAnchorRef.current?.getBoundingClientRect()
      const second = secondAnchorRef.current?.getBoundingClientRect()
      if (!first || !second) return
      const firstPoint = {
        x: first.x + first.width / 2,
        y: first.y + first.height / 2,
      }
      const secondPoint = {
        x: second.x + second.width / 2,
        y: second.y + second.height / 2,
      }
      const isFirstWinner = choreography.combatants[0].valueId === winnerId
      const nextTravel = createSeethingSwarmBattleTravel({
        attacker: isFirstWinner ? firstPoint : secondPoint,
        defender: isFirstWinner ? secondPoint : firstPoint,
        attackerSide: isFirstWinner ? "first" : "second",
        combatantWidth: isFirstWinner ? first.width : second.width,
      })
      setTravel(nextTravel)
      if (nextTravel.x === 0 && nextTravel.y === 0)
        setResultCue((current) => (current === "approach" ? "strike" : current))
    }
    measureTravel()
    const layoutObserver = new ResizeObserver(measureTravel)
    const firstCard = firstAnchorRef.current?.closest("[data-value-card]")
    const secondCard = secondAnchorRef.current?.closest("[data-value-card]")
    if (firstCard) layoutObserver.observe(firstCard)
    if (secondCard) layoutObserver.observe(secondCard)
    if (firstAnchorRef.current) layoutObserver.observe(firstAnchorRef.current)
    if (secondAnchorRef.current) layoutObserver.observe(secondAnchorRef.current)
    window.addEventListener("resize", measureTravel)
    return () => {
      layoutObserver.disconnect()
      window.removeEventListener("resize", measureTravel)
    }
  }, [choreography, readySides, shouldReduceMotion, winnerId])

  const handlePlaybackComplete = (side: SeethingSwarmBattleCombatantSide) => {
    if (cue === "strike") {
      if (
        choreography.combatants.find((combatant) => combatant.side === side)
          ?.valueId === winnerId
      )
        setResultCue("impact")
      return
    }
    if (cue !== "impact") return
    completedSidesRef.current.add(side)
    reportResult()
  }

  const handleReady = (side: SeethingSwarmBattleCombatantSide) => {
    if (cue !== "approach") return
    setReadySides((previous) =>
      previous.has(side) ? previous : new Set([...previous, side]),
    )
  }

  const combatants = choreography.combatants.map(
    (combatant) =>
      function renderCardCombatant(isAttended: boolean, reward?: ReactNode) {
        return (
          <div
            aria-hidden="true"
            key={combatant.side}
            ref={combatant.side === "first" ? firstAnchorRef : secondAnchorRef}
            className="pointer-events-none relative flex size-(--battle-combatant-size) shrink-0 items-end justify-center"
            data-animal-id={combatant.animalId}
            data-combatant-side={combatant.side}
            data-value-id={combatant.valueId}
            data-battle-cue={cue}
          >
            <motion.div
              className="relative flex size-(--battle-combatant-size) shrink-0 items-end justify-center"
              data-combatant-traveler={combatant.side}
              initial={false}
              animate={{
                x:
                  !shouldReduceMotion && combatant.valueId === winnerId
                    ? (travel?.x ?? 0)
                    : 0,
                y:
                  !shouldReduceMotion && combatant.valueId === winnerId
                    ? (travel?.y ?? 0)
                    : 0,
              }}
              transition={{
                duration: shouldReduceMotion
                  ? 0
                  : SEETHING_SWARM_BATTLE_APPROACH_DURATION_MS / 1000,
                ease: "easeOut",
              }}
              onAnimationComplete={() => {
                if (
                  cue === "approach" &&
                  travel &&
                  combatant.valueId === winnerId
                )
                  setResultCue("strike")
              }}
            >
              {reward ? (
                <span className="absolute bottom-full left-1/2 z-10 w-max -translate-x-1/2 pb-1">
                  {reward}
                </span>
              ) : null}
              <span className="relative flex size-28 shrink-0 origin-bottom scale-(--battle-combatant-scale) items-end justify-center">
                {"clips" in combatant ? (
                  <SeethingSwarmCombatant
                    combatant={combatant}
                    isAttended={isAttended}
                    winnerId={winnerId}
                    cue={cue}
                    shouldReduceMotion={shouldReduceMotion}
                    onPlaybackComplete={() =>
                      handlePlaybackComplete(combatant.side)
                    }
                    onReady={() => handleReady(combatant.side)}
                  />
                ) : (
                  <SeethingSwarmPlaceholder
                    key={cue}
                    side={combatant.side}
                    role={resolveSeethingSwarmPlaceholderRole(
                      cue,
                      winnerId === combatant.valueId,
                    )}
                    shouldReduceMotion={shouldReduceMotion}
                    onPlaybackComplete={() =>
                      handlePlaybackComplete(combatant.side)
                    }
                    onReady={() => handleReady(combatant.side)}
                  />
                )}
              </span>
            </motion.div>
          </div>
        )
      },
  )
  return children({ first: combatants[0], second: combatants[1] })
}

export default function SeethingSwarmBattleStage({
  battle,
  pendingBattle = null,
  isNextBattleReady,
  isPaused = false,
  runtimeClipCatalog,
  shouldReduceMotion,
  winnerId,
  onResultAnimationComplete,
  children,
}: {
  battle: PresentedBattle
  pendingBattle?: PresentedBattle | null
  isNextBattleReady: boolean
  isPaused?: boolean
  runtimeClipCatalog: SeethingSwarmRuntimeClipCatalog<StaticImageData>
  shouldReduceMotion: boolean
  winnerId: ValueId | null
  onResultAnimationComplete: () => void
  children: (combatants: {
    first: (isAttended: boolean, reward?: ReactNode) => ReactNode
    second: (isAttended: boolean, reward?: ReactNode) => ReactNode
  }) => ReactNode
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [compactCombatantSize, setCompactCombatantSize] = useState(
    SEETHING_SWARM_BATTLE_TILE_SIZE,
  )
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const measureStage = () => {
      setCompactCombatantSize(
        Math.min(
          SEETHING_SWARM_BATTLE_TILE_SIZE,
          stage.getBoundingClientRect().height / 5,
        ),
      )
    }
    measureStage()
    const observer = new ResizeObserver(measureStage)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])
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
  useEffect(() => {
    if (!pendingBattle) return
    const pendingChoreography = createSeethingSwarmBattleChoreography({
      battle: pendingBattle,
      catalog: runtimeClipCatalog,
    })
    if (pendingChoreography.mode !== "licensed") return
    for (const combatant of pendingChoreography.combatants) {
      const initialClips = new Set([
        ...combatant.clips.entry.sequence,
        ...combatant.clips.rest.sequence,
      ].map((clip) => clip.animationId))
      for (const clip of getSeethingSwarmBattleClips(combatant)) {
        preload(clip.asset.src, {
          as: "image",
          fetchPriority: initialClips.has(clip.animationId) ? "high" : "low",
        })
      }
    }
  }, [pendingBattle, runtimeClipCatalog])
  const stageStyle: SeethingSwarmBattleStageStyle = {
    "--battle-result-duration": `${SEETHING_SWARM_BATTLE_RESULT_DURATION_MS}ms`,
    "--battle-compact-combatant-size": `${compactCombatantSize}px`,
    "--battle-compact-combatant-scale":
      compactCombatantSize / SEETHING_SWARM_BATTLE_TILE_SIZE,
  }

  return (
    <div
      ref={stageRef}
      className="[container-type:size] relative flex min-h-0 min-w-0 flex-1 flex-col [--battle-combatant-scale:var(--battle-compact-combatant-scale)] [--battle-combatant-size:var(--battle-compact-combatant-size)] xl:flex-row xl:[--battle-combatant-scale:2] xl:[--battle-combatant-size:14rem]"
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
