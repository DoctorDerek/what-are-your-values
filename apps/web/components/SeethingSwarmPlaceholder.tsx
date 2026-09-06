import type { SeethingSwarmBattleCombatantSide } from "@game/machines/src/SeethingSwarmBattleChoreography"
import { useEffect, type CSSProperties } from "react"

type SeethingSwarmPlaceholderStyle = CSSProperties & {
  "--battle-recoil": string
  "--battle-tilt": string
}

export default function SeethingSwarmPlaceholder({
  side,
  role,
  shouldReduceMotion,
  onPlaybackComplete,
  onReady,
}: {
  side: SeethingSwarmBattleCombatantSide
  role: "rest" | "attack" | "reaction" | "flourish"
  shouldReduceMotion: boolean
  onPlaybackComplete: () => void
  onReady?: () => void
}) {
  const isFirst = side === "first"
  useEffect(() => onReady?.(), [onReady])
  const placeholderStyle: SeethingSwarmPlaceholderStyle = {
    "--battle-recoil": isFirst ? "-1.25rem" : "1.25rem",
    "--battle-tilt": isFirst ? "-8deg" : "8deg",
  }
  const animationClassName = shouldReduceMotion
    ? "animate-none"
    : role === "attack"
      ? "animate-seething-swarm-placeholder-attack"
      : role === "reaction"
        ? "animate-seething-swarm-placeholder-reaction"
        : role === "flourish"
          ? "animate-seething-swarm-placeholder-rest [animation-duration:var(--battle-result-duration)] [animation-iteration-count:1]"
          : "animate-seething-swarm-placeholder-rest"

  return (
    <span
      className={`relative block h-15 w-18 origin-bottom rounded-[45%_45%_35%_35%] border-4 border-black bg-white shadow-[0.35rem_0.35rem_0_black] before:absolute before:-top-4 before:left-1 before:size-6 before:-rotate-22 before:rounded-[50%_50%_20%_20%] before:border-4 before:border-black before:bg-white after:absolute after:-top-4 after:right-1 after:size-6 after:rotate-22 after:rounded-[50%_50%_20%_20%] after:border-4 after:border-black after:bg-white ${animationClassName}`}
      data-battle-role={role}
      data-placeholder-playback={
        shouldReduceMotion ? "static" : role === "rest" ? "loop" : "one-shot"
      }
      onAnimationEnd={
        role !== "rest" && !shouldReduceMotion ? onPlaybackComplete : undefined
      }
      style={placeholderStyle}
    >
      <span className="absolute top-4 left-1/2 size-[0.55rem] -translate-x-1/2 rounded-full bg-black shadow-[-1rem_0_0_black,1rem_0_0_black]" />
    </span>
  )
}
