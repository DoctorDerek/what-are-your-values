import {
  createSeethingSwarmAnimalPresentationGeometry,
  SEETHING_SWARM_BATTLE_TILE_SIZE,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { ValueId } from "@game/data/src/Value"
import type {
  SeethingSwarmBattleClipRole,
  SeethingSwarmLicensedBattleCombatant,
} from "@game/machines/src/SeethingSwarmBattleChoreography"
import type { SeethingSwarmBattleExchangeCue } from "@game/machines/src/SeethingSwarmBattleExchange"
import { createSeethingSwarmBattlePlayback } from "@game/machines/src/SeethingSwarmBattlePlayback"
import type { StaticImageData } from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import SeethingSwarmAnimal from "@/components/SeethingSwarmAnimal"
import SeethingSwarmPlaceholder from "@/components/SeethingSwarmPlaceholder"

export default function SeethingSwarmCombatant({
  combatant,
  winnerId,
  cue: exchangeCue,
  isAttended,
  shouldReduceMotion,
  onPlaybackComplete,
  onReady,
}: {
  combatant: SeethingSwarmLicensedBattleCombatant<StaticImageData>
  winnerId: ValueId | null
  cue: SeethingSwarmBattleExchangeCue
  isAttended: boolean
  shouldReduceMotion: boolean
  onPlaybackComplete: () => void
  onReady: () => void
}) {
  const [playback, setPlayback] = useState({ cue: exchangeCue, stepIndex: 0 })
  const cue =
    exchangeCue !== "introduction"
      ? exchangeCue
      : isAttended
        ? "attention"
        : playback.cue === "introduction"
          ? "introduction"
          : "rest"
  if (playback.cue !== cue) setPlayback({ cue, stepIndex: 0 })
  const stepIndex = playback.cue === cue ? playback.stepIndex : 0
  const [loadedRoles, setLoadedRoles] = useState<
    ReadonlySet<SeethingSwarmBattleClipRole>
  >(() => new Set())
  const [failedRoles, setFailedRoles] = useState<
    ReadonlySet<SeethingSwarmBattleClipRole>
  >(() => new Set())
  const [displayedRole, setDisplayedRole] =
    useState<SeethingSwarmBattleClipRole>("rest")
  const steps = useMemo(
    () => createSeethingSwarmBattlePlayback({ combatant, winnerId, cue }),
    [combatant, winnerId, cue],
  )
  const maximumIntegerScale = useMemo(
    () =>
      Math.min(
        ...Object.values(combatant.clips).map(
          ({ clip }) =>
            createSeethingSwarmAnimalPresentationGeometry(
              clip.frameWidth,
              clip.frameHeight,
              clip.visibleBounds,
              SEETHING_SWARM_BATTLE_TILE_SIZE,
            ).integerScale,
        ),
      ),
    [combatant],
  )
  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const isComplete = stepIndex === steps.length
  const role = shouldReduceMotion && !winnerId ? "rest" : step.role
  const isReady = loadedRoles.has(role) && !failedRoles.has(role)
  if (isReady && displayedRole !== role) setDisplayedRole(role)
  const retainedRole =
    loadedRoles.has(displayedRole) && !failedRoles.has(displayedRole)
      ? displayedRole
      : [...loadedRoles].find((candidate) => !failedRoles.has(candidate)) ?? "rest"
  const visibleRole = isReady ? role : retainedRole
  const hasVisibleImage = loadedRoles.has(visibleRole) && !failedRoles.has(visibleRole)
  const hasLoadError = failedRoles.has(role)

  useEffect(() => {
    if (isReady || (hasLoadError && hasVisibleImage)) onReady()
  }, [cue, hasLoadError, hasVisibleImage, isReady, onReady])

  const finishStep = useCallback(() => {
    if (isComplete) return
    setPlayback({ cue, stepIndex: stepIndex + 1 })
    if (winnerId && stepIndex + 1 === steps.length) onPlaybackComplete()
  }, [cue, isComplete, onPlaybackComplete, stepIndex, steps.length, winnerId])

  useEffect(() => {
    if (hasLoadError && hasVisibleImage) finishStep()
  }, [finishStep, hasLoadError, hasVisibleImage])

  return (
    <span
      className="relative block size-28 origin-bottom xl:scale-200"
      data-battle-role={role}
    >
      {Object.values(combatant.clips).map((selection) => {
        const isVisible =
          selection.role === visibleRole && hasVisibleImage
        return (
          <span
            key={selection.role}
            className={`absolute inset-0 ${isVisible ? "visible" : "invisible"}`}
            data-battle-active-clip={isVisible}
            data-battle-clip={selection.role}
          >
            <SeethingSwarmAnimal
              clip={selection.clip}
              facing={combatant.side === "first" ? "right" : "left"}
              frameDurationMs={step.frameDurationMs}
              maximumIntegerScale={maximumIntegerScale}
              preload
              playbackMode={
                !isVisible || shouldReduceMotion
                  ? "static"
                  : !isReady || isComplete
                    ? "hold-final-frame"
                    : step.playbackMode
              }
              shouldReduceMotion={shouldReduceMotion}
              tileSize={SEETHING_SWARM_BATTLE_TILE_SIZE}
              onLoadError={() =>
                setFailedRoles(
                  (previous) => new Set([...previous, selection.role]),
                )
              }
              onReady={() =>
                setLoadedRoles(
                  (previous) => new Set([...previous, selection.role]),
                )
              }
              onPlaybackComplete={isVisible && isReady ? finishStep : undefined}
            />
          </span>
        )
      })}
      {!hasVisibleImage ? (
        <SeethingSwarmPlaceholder
          side={combatant.side}
          role={role === "entry" || role === "anticipation" ? "rest" : role}
          shouldReduceMotion={shouldReduceMotion || !hasLoadError}
          onPlaybackComplete={() => {
            if (hasLoadError) finishStep()
          }}
          onReady={hasLoadError ? onReady : undefined}
        />
      ) : null}
    </span>
  )
}
