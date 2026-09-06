import {
  createSeethingSwarmAnimalPresentationGeometry,
  SEETHING_SWARM_BATTLE_TILE_SIZE,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { ValueId } from "@game/data/src/Value"
import type { SeethingSwarmLicensedBattleCombatant } from "@game/machines/src/SeethingSwarmBattleChoreography"
import { createSeethingSwarmBattlePlayback } from "@game/machines/src/SeethingSwarmBattlePlayback"
import type { StaticImageData } from "next/image"
import { useMemo, useState } from "react"
import SeethingSwarmAnimal from "@/components/SeethingSwarmAnimal"
import SeethingSwarmPlaceholder from "@/components/SeethingSwarmPlaceholder"

export default function SeethingSwarmCombatant({
  combatant,
  winnerId,
  shouldReduceMotion,
  onPlaybackComplete,
}: {
  combatant: SeethingSwarmLicensedBattleCombatant<StaticImageData>
  winnerId: ValueId | null
  shouldReduceMotion: boolean
  onPlaybackComplete: () => void
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [hasLoadError, setHasLoadError] = useState(false)
  const steps = useMemo(
    () => createSeethingSwarmBattlePlayback({ combatant, winnerId }),
    [combatant, winnerId],
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

  if (hasLoadError)
    return (
      <SeethingSwarmPlaceholder
        side={combatant.side}
        result={
          !winnerId ? null : winnerId === combatant.valueId ? "winner" : "loser"
        }
        shouldReduceMotion={shouldReduceMotion}
        onPlaybackComplete={onPlaybackComplete}
      />
    )

  return (
    <span data-battle-role={role}>
      <SeethingSwarmAnimal
        key={role}
        clip={combatant.clips[role].clip}
        facing={combatant.side === "first" ? "right" : "left"}
        frameDurationMs={step.frameDurationMs}
        maximumIntegerScale={maximumIntegerScale}
        playbackMode={
          shouldReduceMotion
            ? "static"
            : isComplete
              ? "hold-final-frame"
              : step.playbackMode
        }
        shouldReduceMotion={shouldReduceMotion}
        tileSize={SEETHING_SWARM_BATTLE_TILE_SIZE}
        onLoadError={() => setHasLoadError(true)}
        onPlaybackComplete={() => {
          if (isComplete) return
          setStepIndex(stepIndex + 1)
          if (winnerId && stepIndex + 1 === steps.length) onPlaybackComplete()
        }}
      />
    </span>
  )
}
