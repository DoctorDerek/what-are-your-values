import {
  createSeethingSwarmAnimalPresentationGeometry,
  SEETHING_SWARM_BATTLE_TILE_SIZE,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { ValueId } from "@game/data/src/Value"
import type { SeethingSwarmLicensedBattleCombatant } from "@game/machines/src/SeethingSwarmBattleChoreography"
import type { SeethingSwarmBattleExchangeCue } from "@game/machines/src/SeethingSwarmBattleExchange"
import {
  createSeethingSwarmBattlePlayback,
  getSeethingSwarmBattleClips,
} from "@game/machines/src/SeethingSwarmBattlePlayback"
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
  const requestedStepIndex = playback.cue === cue ? playback.stepIndex : 0
  const [loadedClips, setLoadedClips] = useState<ReadonlySet<string>>(() => new Set())
  const [failedClips, setFailedClips] = useState<ReadonlySet<string>>(() => new Set())
  const [displayedClipId, setDisplayedClipId] = useState(combatant.clips.rest.clip.animationId)
  const residentClips = useMemo(() => getSeethingSwarmBattleClips(combatant), [combatant])
  const steps = useMemo(
    () => createSeethingSwarmBattlePlayback({ combatant, winnerId, cue }),
    [combatant, winnerId, cue],
  )
  const maximumIntegerScale = useMemo(
    () =>
      Math.min(
        ...residentClips.map(
          (clip) =>
            createSeethingSwarmAnimalPresentationGeometry(
              clip.frameWidth,
              clip.frameHeight,
              clip.visibleBounds,
              SEETHING_SWARM_BATTLE_TILE_SIZE,
            ).integerScale,
        ),
      ),
    [residentClips],
  )
  const retainedClipId =
    loadedClips.has(displayedClipId) && !failedClips.has(displayedClipId)
      ? displayedClipId
      : ([...loadedClips].find((candidate) => !failedClips.has(candidate)) ??
        combatant.clips.rest.clip.animationId)
  const hasRetainedImage =
    loadedClips.has(retainedClipId) && !failedClips.has(retainedClipId)
  const nextAvailableStepIndex = steps.findIndex(
    (candidate, index) =>
      index >= requestedStepIndex && !failedClips.has(candidate.clip.animationId),
  )
  const stepIndex = hasRetainedImage
    ? nextAvailableStepIndex === -1
      ? steps.length
      : nextAvailableStepIndex
    : requestedStepIndex
  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const isComplete = stepIndex === steps.length
  const role = shouldReduceMotion && !winnerId ? "rest" : step.role
  const requestedClipId = shouldReduceMotion && !winnerId
    ? combatant.clips.rest.clip.animationId
    : step.clip.animationId
  const isReady = loadedClips.has(requestedClipId) && !failedClips.has(requestedClipId)
  if (isReady && displayedClipId !== requestedClipId) setDisplayedClipId(requestedClipId)
  const visibleClipId = isReady ? requestedClipId : retainedClipId
  const hasVisibleImage =
    loadedClips.has(visibleClipId) && !failedClips.has(visibleClipId)
  const hasLoadError = failedClips.has(requestedClipId)

  useEffect(() => {
    if (isReady || (hasLoadError && hasVisibleImage)) onReady()
  }, [cue, hasLoadError, hasVisibleImage, isReady, onReady])

  const finishStep = () => {
    if (isComplete) return
    setPlayback({ cue, stepIndex: stepIndex + 1 })
    if (winnerId && stepIndex + 1 === steps.length) onPlaybackComplete()
  }

  useEffect(() => {
    if (hasLoadError && hasVisibleImage && isComplete && winnerId)
      onPlaybackComplete()
  }, [hasLoadError, hasVisibleImage, isComplete, onPlaybackComplete, winnerId])

  const hasBlockingSteps = steps.slice(stepIndex).some((candidate) => candidate.blocksResult)
  useEffect(() => {
    if (winnerId && (cue === "strike" || cue === "impact") && !hasBlockingSteps)
      onPlaybackComplete()
  }, [cue, hasBlockingSteps, onPlaybackComplete, winnerId])

  return (
    <View className="relative size-28 origin-bottom xl:scale-200">
      {residentClips.map((clip) => {
        const isVisible =
          clip.animationId === visibleClipId && hasVisibleImage
        return (
          <View
            key={clip.animationId}
            className={`absolute inset-0 ${isVisible ? "opacity-100" : "opacity-0"}`}
            testID={`battle-clip-${combatant.side}-${clip.animationId}`}
          >
            <NativeSeethingSwarmAnimal
              clip={clip}
              playbackIdentity={`${cue}:${stepIndex}`}
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
                setFailedClips(
                  (previous) => new Set([...previous, clip.animationId]),
                )
              }
              onReady={() =>
                setLoadedClips(
                  (previous) => new Set([...previous, clip.animationId]),
                )
              }
              onPlaybackComplete={isVisible && isReady ? finishStep : undefined}
            />
          </View>
        )
      })}
      {!hasVisibleImage ? (
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
