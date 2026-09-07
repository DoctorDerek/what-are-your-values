import type { SeethingSwarmSourceAnimationId } from "./SeethingSwarmBattleAnimationPolicy"
import type { SeethingSwarmRuntimeCharacterClip } from "./SeethingSwarmRuntimeClipCatalog"

function defineSequenceRecipe(
  animationIds: readonly SeethingSwarmSourceAnimationId[],
  ...candidates: readonly (readonly SeethingSwarmSourceAnimationId[])[]
) {
  return Object.freeze({
    animationIds: Object.freeze(animationIds),
    candidates: Object.freeze(candidates.map((candidate) => Object.freeze(candidate))),
  })
}

export const SEETHING_SWARM_BATTLE_SEQUENCE_RECIPES = Object.freeze([
  defineSequenceRecipe(["hide", "unhide"], ["hide", "unhide"]),
  defineSequenceRecipe(["jump"], ["jump", "land"]),
  defineSequenceRecipe(["fall"],
    ["jump", "fall", "land"],
    ["takeoff", "fall", "land"],
    ["fly_forward", "fall", "land"],
  ),
  defineSequenceRecipe(["land"], ["jump", "land"], ["takeoff", "land"], ["fly_forward", "land"]),
  defineSequenceRecipe(["land_upright"], ["fly_forward", "land_upright"]),
  defineSequenceRecipe(["takeoff", "fly"], ["takeoff", "fly", "land"], ["jump", "fly", "land"]),
  defineSequenceRecipe(["fly_forward"], ["fly_forward", "land"], ["fly_forward", "land_upright"]),
  defineSequenceRecipe(["fly_idle"], ["fly_forward", "fly_idle", "land_upright"]),
  defineSequenceRecipe(["fly_idle01"], ["fly_forward", "fly_idle01", "land"]),
  defineSequenceRecipe(["fly_idle02"], ["fly_forward", "fly_idle02", "land"]),
  defineSequenceRecipe(["soar"], ["takeoff", "soar", "land"]),
  defineSequenceRecipe(["soar_call"], ["takeoff", "soar_call", "land"]),
  defineSequenceRecipe(["attack_air"], ["takeoff", "attack_air", "land"]),
  defineSequenceRecipe(["liedown_godown", "liedown_idle", "liedown_getup"],
    ["liedown_godown", "liedown_idle", "liedown_getup"],
  ),
])

const SETTLED_REST_ANIMATION_IDS = Object.freeze(["idle", "idle_upright", "stand"] as const)

export function resolveSeethingSwarmBattleSequence<PlatformAsset>(
  clip: SeethingSwarmRuntimeCharacterClip<PlatformAsset>,
  availableClips: readonly SeethingSwarmRuntimeCharacterClip<PlatformAsset>[],
  settlesIntoRest: boolean,
): readonly SeethingSwarmRuntimeCharacterClip<PlatformAsset>[] | null {
  const recipe = SEETHING_SWARM_BATTLE_SEQUENCE_RECIPES.find((candidate) =>
    candidate.animationIds.some((animationId) => animationId === clip.animationId),
  )
  if (!recipe) return Object.freeze([clip])

  for (const candidate of recipe.candidates) {
    const sequence = candidate.map((animationId) =>
      availableClips.find((source) => source.animationId === animationId),
    )
    if (!sequence.every((source) => source !== undefined)) continue
    if (!settlesIntoRest) return Object.freeze(sequence)

    for (const animationId of SETTLED_REST_ANIMATION_IDS) {
      const rest = availableClips.find((source) => source.animationId === animationId)
      if (rest) return Object.freeze([...sequence, rest])
    }
  }
  return null
}
