import {
  SEETHING_SWARM_BATTLE_RESULT_DURATION_MS,
  SEETHING_SWARM_BATTLE_TILE_SIZE,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { SeethingSwarmRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import type { ValueId } from "@game/data/src/Value"
import type { PresentedBattle } from "@game/machines/src/CombatMachine"
import {
  createSeethingSwarmBattleChoreography,
  type SeethingSwarmBattleClipRole,
  type SeethingSwarmBattleCombatantSide,
} from "@game/machines/src/SeethingSwarmBattleChoreography"
import type { StaticImageData } from "next/image"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react"
import SeethingSwarmAnimal from "./SeethingSwarmAnimal"

type SeethingSwarmBattleStageStyle = CSSProperties & {
  "--battle-result-duration": string
}

type SeethingSwarmPlaceholderStyle = CSSProperties & {
  "--battle-recoil": string
  "--battle-tilt": string
  "--battle-travel": string
}

function createResultFrameDurationMs(frameCount: number) {
  return Math.max(
    1,
    Math.floor(SEETHING_SWARM_BATTLE_RESULT_DURATION_MS / frameCount),
  )
}

function resolveBattleRole(
  valueId: ValueId,
  winnerId: ValueId | null,
): SeethingSwarmBattleClipRole {
  if (!winnerId) return "rest"
  return valueId === winnerId ? "attack" : "reaction"
}

function getPlaceholderAnimationClassName({
  role,
  shouldReduceMotion,
}: {
  readonly role: SeethingSwarmBattleClipRole
  readonly shouldReduceMotion: boolean
}) {
  if (shouldReduceMotion) return "animate-none"
  if (role === "attack") return "animate-seething-swarm-placeholder-attack"
  if (role === "reaction") return "animate-seething-swarm-placeholder-reaction"
  return "animate-seething-swarm-placeholder-rest"
}

export default function SeethingSwarmBattleStage({
  battle,
  isNextBattleReady,
  runtimeClipCatalog,
  shouldReduceMotion,
  winnerId,
  onResultAnimationComplete,
}: {
  battle: PresentedBattle
  isNextBattleReady: boolean
  runtimeClipCatalog: SeethingSwarmRuntimeClipCatalog<StaticImageData>
  shouldReduceMotion: boolean
  winnerId: ValueId | null
  onResultAnimationComplete: () => void
}) {
  const choreography = useMemo(
    () =>
      createSeethingSwarmBattleChoreography({
        battle,
        catalog: runtimeClipCatalog,
      }),
    [battle, runtimeClipCatalog],
  )
  const resultIdentity = winnerId
    ? `${choreography.choreographyIdentity}:${winnerId}`
    : null
  const completedResultIdentityRef = useRef<string | null>(null)
  const completedCombatantSidesRef = useRef<
    ReadonlySet<SeethingSwarmBattleCombatantSide>
  >(new Set())

  const completeResultIfReady = useCallback(() => {
    if (
      !resultIdentity ||
      !isNextBattleReady ||
      completedResultIdentityRef.current === resultIdentity ||
      (!shouldReduceMotion && completedCombatantSidesRef.current.size !== 2)
    )
      return

    completedResultIdentityRef.current = resultIdentity
    onResultAnimationComplete()
  }, [
    isNextBattleReady,
    onResultAnimationComplete,
    resultIdentity,
    shouldReduceMotion,
  ])

  const handleCombatantAnimationComplete = useCallback(
    (side: SeethingSwarmBattleCombatantSide) => {
      if (
        !resultIdentity ||
        completedResultIdentityRef.current === resultIdentity
      )
        return

      completedCombatantSidesRef.current = new Set([
        ...completedCombatantSidesRef.current,
        side,
      ])
      completeResultIfReady()
    },
    [completeResultIfReady, resultIdentity],
  )

  useEffect(() => {
    completedCombatantSidesRef.current = new Set()
    if (!resultIdentity) completedResultIdentityRef.current = null
  }, [resultIdentity])

  useEffect(() => completeResultIfReady(), [completeResultIfReady])

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
      {choreography.combatants.map((combatant, index) => {
        const role = resolveBattleRole(combatant.valueId, winnerId)
        const isFirst = combatant.side === "first"
        const placeholderStyle: SeethingSwarmPlaceholderStyle = {
          "--battle-recoil": isFirst ? "-1.25rem" : "1.25rem",
          "--battle-tilt": isFirst ? "-8deg" : "8deg",
          "--battle-travel": isFirst ? "2rem" : "-2rem",
        }

        return (
          <div
            key={combatant.side}
            className={`row-start-1 flex min-w-0 flex-col items-center justify-end self-stretch ${isFirst ? "col-start-1" : "col-start-3"}`}
            data-animal-id={combatant.animalId}
            data-battle-role={role}
            data-combatant-side={combatant.side}
            data-value-id={combatant.valueId}
            style={placeholderStyle}
          >
            {"clips" in combatant ? (
              <SeethingSwarmAnimal
                key={`${choreography.choreographyIdentity}:${combatant.side}:${role}`}
                clip={combatant.clips[role].clip}
                facing={isFirst ? "right" : "left"}
                frameDurationMs={
                  role === "rest"
                    ? undefined
                    : createResultFrameDurationMs(
                        combatant.clips[role].clip.frameCount,
                      )
                }
                playbackMode={role === "rest" ? "loop" : "one-shot"}
                shouldReduceMotion={shouldReduceMotion}
                tileSize={SEETHING_SWARM_BATTLE_TILE_SIZE}
                onPlaybackComplete={() =>
                  handleCombatantAnimationComplete(combatant.side)
                }
              />
            ) : (
              <span
                key={`${choreography.choreographyIdentity}:${combatant.side}:${role}`}
                className={`relative block h-15 w-18 origin-bottom rounded-[45%_45%_35%_35%] border-4 border-black bg-white shadow-[0.35rem_0.35rem_0_black] before:absolute before:-top-4 before:left-1 before:size-6 before:-rotate-22 before:rounded-[50%_50%_20%_20%] before:border-4 before:border-black before:bg-white after:absolute after:-top-4 after:right-1 after:size-6 after:rotate-22 after:rounded-[50%_50%_20%_20%] after:border-4 after:border-black after:bg-white ${getPlaceholderAnimationClassName({ role, shouldReduceMotion })}`}
                data-placeholder-playback={
                  role === "rest" ? "loop" : "one-shot"
                }
                onAnimationEnd={
                  winnerId && !shouldReduceMotion
                    ? () => handleCombatantAnimationComplete(combatant.side)
                    : undefined
                }
              >
                <span className="absolute top-4 left-1/2 size-[0.55rem] -translate-x-1/2 rounded-full bg-black shadow-[-1rem_0_0_black,1rem_0_0_black]" />
              </span>
            )}

            <span className="mt-1 border-2 border-white bg-black px-2 py-0.5 text-center text-xs leading-none font-black text-white xl:mt-2 xl:text-base">
              {index + 1}
            </span>
          </div>
        )
      })}

      <span className="col-start-2 row-start-1 self-center border-4 border-white bg-black px-2 py-1 text-sm font-black uppercase shadow-[3px_3px_0px_0px_#ffffff] xl:px-3 xl:py-2 xl:text-xl">
        VS
      </span>
    </div>
  )
}
