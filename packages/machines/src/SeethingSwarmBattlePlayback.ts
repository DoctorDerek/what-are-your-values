import {
  SEETHING_SWARM_BATTLE_RESULT_DURATION_MS,
  SEETHING_SWARM_HUB_FRAME_DURATION_MS,
  type SeethingSwarmAnimalPlaybackMode,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { ValueId } from "@game/data/src/Value"
import type {
  SeethingSwarmBattleClipRole,
  SeethingSwarmBattleClipSelection,
  SeethingSwarmLicensedBattleCombatant,
} from "./SeethingSwarmBattleChoreography"

const BATTLE_INTRODUCTION_ROLES = Object.freeze([
  "entry",
  "anticipation",
  "rest",
] as const)
const BATTLE_WINNER_ROLES = Object.freeze(["attack", "flourish"] as const)
const BATTLE_LOSER_ROLES = Object.freeze(["reaction"] as const)

export type SeethingSwarmBattlePlaybackStep<PlatformAsset> =
  SeethingSwarmBattleClipSelection<PlatformAsset> &
    Readonly<{
      playbackMode: SeethingSwarmAnimalPlaybackMode
      frameDurationMs: number
    }>

export function createSeethingSwarmBattlePlayback<PlatformAsset>({
  combatant,
  winnerId,
}: {
  readonly combatant: SeethingSwarmLicensedBattleCombatant<PlatformAsset>
  readonly winnerId: ValueId | null
}): readonly SeethingSwarmBattlePlaybackStep<PlatformAsset>[] {
  const roles: readonly SeethingSwarmBattleClipRole[] = !winnerId
    ? BATTLE_INTRODUCTION_ROLES
    : combatant.valueId === winnerId
      ? BATTLE_WINNER_ROLES
      : BATTLE_LOSER_ROLES
  const frameCount = roles.reduce(
    (total, role) => total + combatant.clips[role].clip.frameCount,
    0,
  )
  const frameDurationMs = winnerId
    ? Math.max(
        1,
        Math.floor(SEETHING_SWARM_BATTLE_RESULT_DURATION_MS / frameCount),
      )
    : SEETHING_SWARM_HUB_FRAME_DURATION_MS

  return Object.freeze(
    roles.map((role) =>
      Object.freeze({
        ...combatant.clips[role],
        playbackMode: role === "rest" ? "loop" : "one-shot",
        frameDurationMs,
      } satisfies SeethingSwarmBattlePlaybackStep<PlatformAsset>),
    ),
  )
}
