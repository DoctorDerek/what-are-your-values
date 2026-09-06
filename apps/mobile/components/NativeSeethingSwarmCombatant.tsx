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
import { useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import NativeSeethingSwarmAnimal from "@/components/NativeSeethingSwarmAnimal"
import NativeSeethingSwarmPlaceholder from "@/components/NativeSeethingSwarmPlaceholder"

export default function NativeSeethingSwarmCombatant({
  combatant,
  winnerId,
  cue: exchangeCue,
  isAttended,
  shouldReduceMotion,
  onPlaybackComplete,
  onReady,
}: {
  combatant: SeethingSwarmLicensedBattleCombatant<number>
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
  const isReady = loadedRoles.has(role)
  if (isReady && displayedRole !== role) setDisplayedRole(role)
  const visibleRole = isReady ? role : displayedRole
  const hasVisibleImage = loadedRoles.has(visibleRole)
  const hasLoadError = failedRoles.has(role)

  useEffect(() => {
    if (isReady) onReady()
  }, [cue, isReady, onReady])

  const finishStep = () => {
    if (isComplete) return
    setPlayback({ cue, stepIndex: stepIndex + 1 })
    if (winnerId && stepIndex + 1 === steps.length) onPlaybackComplete()
  }

  return (
    <View className="relative size-28 origin-bottom xl:scale-200">
      {Object.values(combatant.clips).map((selection) => {
        const isVisible =
          selection.role === visibleRole && hasVisibleImage && !hasLoadError
        return (
          <View
            key={selection.role}
            className={`absolute inset-0 ${isVisible ? "opacity-100" : "opacity-0"}`}
            testID={`battle-clip-${combatant.side}-${selection.role}`}
          >
            <NativeSeethingSwarmAnimal
              clip={selection.clip}
              facing={combatant.side === "first" ? "right" : "left"}
              frameDurationMs={step.frameDurationMs}
              maximumIntegerScale={maximumIntegerScale}
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
          </View>
        )
      })}
      {!hasVisibleImage || hasLoadError ? (
        <NativeSeethingSwarmPlaceholder
          side={combatant.side}
          role={role === "entry" || role === "anticipation" ? "rest" : role}
          shouldReduceMotion={shouldReduceMotion || !hasLoadError}
          onPlaybackComplete={() => {
            if (hasLoadError) finishStep()
          }}
          onReady={hasLoadError ? onReady : undefined}
        />
      ) : null}
    </View>
  )
}
