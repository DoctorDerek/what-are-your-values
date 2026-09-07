import {
  SEETHING_SWARM_BATTLE_FRAME_DURATION_MS,
  SEETHING_SWARM_HUB_FRAME_DURATION_MS,
  type SeethingSwarmAnimalPlaybackMode,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { SeethingSwarmRuntimeCharacterClip } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import type { ValueId } from "@game/data/src/Value"
import type {
  SeethingSwarmBattleClipRole,
  SeethingSwarmBattleClipSelection,
  SeethingSwarmLicensedBattleCombatant,
} from "./SeethingSwarmBattleChoreography"
import type { SeethingSwarmBattleExchangeCue } from "./SeethingSwarmBattleExchange"

const BATTLE_INTRODUCTION_ROLES = Object.freeze(["entry", "anticipation", "rest"] as const)
const BATTLE_ATTENTION_ROLES = Object.freeze(["anticipation", "flourish", "rest"] as const)

export type SeethingSwarmBattlePlaybackStep<PlatformAsset> =
  Omit<SeethingSwarmBattleClipSelection<PlatformAsset>, "sequence"> &
    Readonly<{
      playbackMode: SeethingSwarmAnimalPlaybackMode
      frameDurationMs: number
      blocksResult: boolean
    }>

export function getSeethingSwarmBattleClips<PlatformAsset>(
  combatant: SeethingSwarmLicensedBattleCombatant<PlatformAsset>,
) {
  const clipsById = new Map<string, SeethingSwarmRuntimeCharacterClip<PlatformAsset>>()
  for (const selection of Object.values(combatant.clips)) {
    for (const clip of selection.sequence) clipsById.set(clip.animationId, clip)
  }
  return Object.freeze([...clipsById.values()])
}

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
    cue === "introduction" ? BATTLE_INTRODUCTION_ROLES
      : cue === "attention" ? BATTLE_ATTENTION_ROLES
      : cue === "strike" && isWinner ? ["attack"]
      : cue === "impact" ? isWinner ? ["attack", "flourish"] : ["reaction"]
      : ["rest"]

  const steps: SeethingSwarmBattlePlaybackStep<PlatformAsset>[] = []
  for (const role of roles) {
    const selection = combatant.clips[role]
    const contactIndex = selection.sequence.findIndex((clip) => clip.animationId === selection.clip.animationId)
    const sequence = role === "attack"
      ? cue === "impact" ? selection.sequence.slice(contactIndex + 1) : selection.sequence.slice(0, contactIndex + 1)
      : selection.sequence
    const blocksResult = role === "attack" || (cue === "impact" && role === "reaction")
    sequence.forEach((clip, index) => {
      const playbackMode = role === "rest" && index === sequence.length - 1 ? "loop" : "one-shot"
      const previous = steps.at(-1)
      if (previous?.clip.animationId === clip.animationId && previous.playbackMode === playbackMode && previous.blocksResult === blocksResult) return
      steps.push(Object.freeze({
        role,
        semanticFamily: selection.semanticFamily,
        clip,
        playbackMode,
        frameDurationMs: blocksResult ? SEETHING_SWARM_BATTLE_FRAME_DURATION_MS : SEETHING_SWARM_HUB_FRAME_DURATION_MS,
        blocksResult,
      }))
    })
  }
  return Object.freeze(steps)
}
