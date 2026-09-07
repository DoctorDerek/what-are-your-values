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
import type { SeethingSwarmBattleExchangeCue } from "./SeethingSwarmBattleExchange"

const BATTLE_INTRODUCTION_ROLES = Object.freeze([
  "entry",
  "anticipation",
  "rest",
] as const)
const BATTLE_WINNER_ROLES = Object.freeze(["attack", "flourish"] as const)
const BATTLE_LOSER_ROLES = Object.freeze(["reaction"] as const)

export type SeethingSwarmBattlePlaybackStep<PlatformAsset> =
  Omit<SeethingSwarmBattleClipSelection<PlatformAsset>, "sequence"> &
    Readonly<{
      playbackMode: SeethingSwarmAnimalPlaybackMode
      frameDurationMs: number
    }>

export function createSeethingSwarmBattlePlayback<PlatformAsset>({
  combatant,
  winnerId,
  cue,
}: {
  readonly combatant: SeethingSwarmLicensedBattleCombatant<PlatformAsset>
  readonly winnerId: ValueId | null
  readonly cue: SeethingSwarmBattleExchangeCue
}): readonly SeethingSwarmBattlePlaybackStep<PlatformAsset>[] {
  const isWinner = combatant.valueId === winnerId
  const roles: readonly SeethingSwarmBattleClipRole[] =
    cue === "introduction"
      ? BATTLE_INTRODUCTION_ROLES
      : cue === "attention"
        ? ["anticipation", "rest"]
        : cue === "strike" && isWinner
          ? ["attack"]
          : cue === "impact"
            ? isWinner
              ? ["flourish"]
              : BATTLE_LOSER_ROLES
            : ["rest"]
  const resultRoles = isWinner ? BATTLE_WINNER_ROLES : BATTLE_LOSER_ROLES
  const frameCount = (winnerId ? resultRoles : roles).reduce(
    (total, role) =>
      total +
      combatant.clips[role].sequence.reduce(
        (sequenceFrames, clip) => sequenceFrames + clip.frameCount,
        0,
      ),
    0,
  )
  const frameDurationMs = winnerId
    ? Math.max(
        1,
        Math.floor(SEETHING_SWARM_BATTLE_RESULT_DURATION_MS / frameCount),
      )
    : SEETHING_SWARM_HUB_FRAME_DURATION_MS

  return Object.freeze(
    roles.flatMap((role) => {
      const selection = combatant.clips[role]
      return selection.sequence.map((clip, index) =>
        Object.freeze({
          role,
          semanticFamily: selection.semanticFamily,
          clip,
          playbackMode:
            role === "rest" && index === selection.sequence.length - 1
              ? "loop"
              : "one-shot",
          frameDurationMs:
            role === "rest"
              ? SEETHING_SWARM_HUB_FRAME_DURATION_MS
              : frameDurationMs,
        } satisfies SeethingSwarmBattlePlaybackStep<PlatformAsset>),
      )
    }),
  )
}
