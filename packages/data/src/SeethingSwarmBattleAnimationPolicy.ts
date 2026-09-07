import { SEETHING_SWARM_SOURCE_SNAPSHOT } from "./SeethingSwarmSourceEvidence"

export const SEETHING_SWARM_BATTLE_CLIP_USAGE_KINDS = Object.freeze([
  "battle-eligible",
  "environment-gated",
  "terminal-disabled",
] as const)

export type SeethingSwarmBattleClipUsageKind =
  (typeof SEETHING_SWARM_BATTLE_CLIP_USAGE_KINDS)[number]

export const SEETHING_SWARM_BATTLE_SEMANTIC_FAMILIES = Object.freeze([
  "rest",
  "anticipation",
  "attack",
  "reaction",
  "celebration",
  "entry-exit",
] as const)

export type SeethingSwarmBattleSemanticFamily =
  (typeof SEETHING_SWARM_BATTLE_SEMANTIC_FAMILIES)[number]

export type SeethingSwarmBattleEligibleAnimationPolicy = Readonly<{
  animationId: string
  usageKind: "battle-eligible"
  semanticFamilies: readonly SeethingSwarmBattleSemanticFamily[]
}>

export type SeethingSwarmEnvironmentGatedAnimationPolicy = Readonly<{
  animationId: string
  usageKind: "environment-gated"
}>

export type SeethingSwarmTerminalDisabledAnimationPolicy = Readonly<{
  animationId: string
  usageKind: "terminal-disabled"
}>

export type SeethingSwarmBattleAnimationPolicy =
  | SeethingSwarmBattleEligibleAnimationPolicy
  | SeethingSwarmEnvironmentGatedAnimationPolicy
  | SeethingSwarmTerminalDisabledAnimationPolicy

function defineBattleEligibleAnimationPolicy<const AnimationId extends string>(
  animationId: AnimationId,
  ...semanticFamilies: readonly SeethingSwarmBattleSemanticFamily[]
) {
  if (semanticFamilies.length === 0) {
    throw new Error(
      `Battle-eligible SeethingSwarm animation requires a semantic family: ${animationId}`,
    )
  }

  return Object.freeze({
    animationId,
    usageKind: "battle-eligible",
    semanticFamilies: Object.freeze(semanticFamilies),
  }) satisfies SeethingSwarmBattleEligibleAnimationPolicy
}

function defineEnvironmentGatedAnimationPolicy<
  const AnimationId extends string,
>(animationId: AnimationId) {
  return Object.freeze({
    animationId,
    usageKind: "environment-gated",
  }) satisfies SeethingSwarmEnvironmentGatedAnimationPolicy
}

function defineTerminalDisabledAnimationPolicy<
  const AnimationId extends string,
>(animationId: AnimationId) {
  return Object.freeze({
    animationId,
    usageKind: "terminal-disabled",
  }) satisfies SeethingSwarmTerminalDisabledAnimationPolicy
}

export const SEETHING_SWARM_BATTLE_ANIMATION_POLICIES = Object.freeze([
  defineBattleEligibleAnimationPolicy("alerted", "anticipation"),
  defineBattleEligibleAnimationPolicy("attack", "attack"),
  defineBattleEligibleAnimationPolicy("attack_air", "attack"),
  defineBattleEligibleAnimationPolicy("attack_ground", "attack"),
  defineBattleEligibleAnimationPolicy("attack01", "attack"),
  defineBattleEligibleAnimationPolicy("attack02", "attack"),
  defineEnvironmentGatedAnimationPolicy("attackdiagonal"),
  defineBattleEligibleAnimationPolicy("attackforward", "attack"),
  defineEnvironmentGatedAnimationPolicy("attackup"),
  defineBattleEligibleAnimationPolicy("bark", "anticipation", "celebration"),
  defineBattleEligibleAnimationPolicy("bite", "attack"),
  defineBattleEligibleAnimationPolicy("call", "anticipation", "celebration"),
  defineBattleEligibleAnimationPolicy("croak", "anticipation", "celebration"),
  defineBattleEligibleAnimationPolicy("crouch", "anticipation"),
  defineBattleEligibleAnimationPolicy("dance", "celebration"),
  defineBattleEligibleAnimationPolicy("dash", "entry-exit"),
  defineTerminalDisabledAnimationPolicy("die"),
  defineBattleEligibleAnimationPolicy("display", "anticipation", "celebration"),
  defineEnvironmentGatedAnimationPolicy("eat"),
  defineBattleEligibleAnimationPolicy("fall", "entry-exit"),
  defineBattleEligibleAnimationPolicy("fly", "entry-exit"),
  defineBattleEligibleAnimationPolicy("fly_forward", "entry-exit"),
  defineBattleEligibleAnimationPolicy("fly_idle", "rest"),
  defineBattleEligibleAnimationPolicy("fly_idle01", "rest"),
  defineBattleEligibleAnimationPolicy("fly_idle02", "rest"),
  defineBattleEligibleAnimationPolicy("fright", "reaction"),
  defineBattleEligibleAnimationPolicy("growl", "anticipation", "celebration"),
  defineBattleEligibleAnimationPolicy("hide", "reaction"),
  defineBattleEligibleAnimationPolicy("hop", "entry-exit"),
  defineBattleEligibleAnimationPolicy("howl", "anticipation", "celebration"),
  defineBattleEligibleAnimationPolicy("hurt", "reaction"),
  defineBattleEligibleAnimationPolicy("idle", "rest"),
  defineBattleEligibleAnimationPolicy("idle_blink", "rest"),
  defineBattleEligibleAnimationPolicy("idle_call", "rest", "celebration"),
  defineBattleEligibleAnimationPolicy("idle_caw", "rest", "celebration"),
  defineBattleEligibleAnimationPolicy("idle_laugh", "rest", "celebration"),
  defineBattleEligibleAnimationPolicy("idle_upright", "rest"),
  defineBattleEligibleAnimationPolicy("idle_upright_blink", "rest"),
  defineEnvironmentGatedAnimationPolicy("idle_upsidedown"),
  defineEnvironmentGatedAnimationPolicy("idle_upsidedown_blink"),
  defineBattleEligibleAnimationPolicy("idle02", "rest"),
  defineBattleEligibleAnimationPolicy("idle02_blink", "rest"),
  defineBattleEligibleAnimationPolicy("jump", "entry-exit"),
  defineBattleEligibleAnimationPolicy("land", "entry-exit"),
  defineBattleEligibleAnimationPolicy("land_upright", "entry-exit"),
  defineEnvironmentGatedAnimationPolicy("land_upsidedown"),
  defineEnvironmentGatedAnimationPolicy("ledgeclimb"),
  defineEnvironmentGatedAnimationPolicy("ledgeclimb_struggle"),
  defineEnvironmentGatedAnimationPolicy("ledgegrab"),
  defineEnvironmentGatedAnimationPolicy("ledgeidle"),
  defineBattleEligibleAnimationPolicy("liedown", "rest"),
  defineBattleEligibleAnimationPolicy("liedown_getup", "entry-exit"),
  defineBattleEligibleAnimationPolicy("liedown_godown", "entry-exit"),
  defineBattleEligibleAnimationPolicy("liedown_idle", "rest"),
  defineBattleEligibleAnimationPolicy("peck", "attack"),
  defineBattleEligibleAnimationPolicy("run", "entry-exit"),
  defineBattleEligibleAnimationPolicy("sit", "rest"),
  defineBattleEligibleAnimationPolicy("sit_blink", "rest"),
  defineBattleEligibleAnimationPolicy(
    "sit_call",
    "anticipation",
    "celebration",
  ),
  defineBattleEligibleAnimationPolicy("sit_caw", "anticipation", "celebration"),
  defineBattleEligibleAnimationPolicy(
    "sit_howl",
    "anticipation",
    "celebration",
  ),
  defineBattleEligibleAnimationPolicy("sit_leanback", "rest"),
  defineEnvironmentGatedAnimationPolicy("sit_leanback_eat"),
  defineBattleEligibleAnimationPolicy("sit_leanback_laugh", "celebration"),
  defineBattleEligibleAnimationPolicy("sit_leanforward", "rest"),
  defineBattleEligibleAnimationPolicy("sit01", "rest"),
  defineBattleEligibleAnimationPolicy("sit02", "rest"),
  defineEnvironmentGatedAnimationPolicy("sleep"),
  defineBattleEligibleAnimationPolicy("sneak", "entry-exit"),
  defineBattleEligibleAnimationPolicy("sniff", "anticipation"),
  defineBattleEligibleAnimationPolicy("soar", "entry-exit"),
  defineBattleEligibleAnimationPolicy("soar_call", "entry-exit", "celebration"),
  defineBattleEligibleAnimationPolicy("stand", "rest"),
  defineEnvironmentGatedAnimationPolicy("swim"),
  defineEnvironmentGatedAnimationPolicy("swim_forward"),
  defineEnvironmentGatedAnimationPolicy("swim_idle"),
  defineEnvironmentGatedAnimationPolicy("swimattackdiagonal"),
  defineEnvironmentGatedAnimationPolicy("swimattackforward"),
  defineEnvironmentGatedAnimationPolicy("swimattackup"),
  defineEnvironmentGatedAnimationPolicy("swimforward"),
  defineEnvironmentGatedAnimationPolicy("swimidle"),
  defineBattleEligibleAnimationPolicy("takeoff", "entry-exit"),
  defineBattleEligibleAnimationPolicy("unhide", "reaction"),
  defineBattleEligibleAnimationPolicy("walk", "entry-exit"),
  defineEnvironmentGatedAnimationPolicy("wallclimb"),
  defineEnvironmentGatedAnimationPolicy("wallgrab"),
])

export type SeethingSwarmSourceAnimationId =
  (typeof SEETHING_SWARM_BATTLE_ANIMATION_POLICIES)[number]["animationId"]

function createBattleAnimationPolicyById() {
  if (
    SEETHING_SWARM_BATTLE_ANIMATION_POLICIES.length !==
    SEETHING_SWARM_SOURCE_SNAPSHOT.distinctAnimationIdCount
  ) {
    throw new Error(
      `Invalid SeethingSwarm animation policy count: expected ${SEETHING_SWARM_SOURCE_SNAPSHOT.distinctAnimationIdCount}, received ${SEETHING_SWARM_BATTLE_ANIMATION_POLICIES.length}`,
    )
  }

  const policiesById = new Map<
    SeethingSwarmSourceAnimationId,
    SeethingSwarmBattleAnimationPolicy
  >()
  for (const policy of SEETHING_SWARM_BATTLE_ANIMATION_POLICIES) {
    if (policiesById.has(policy.animationId)) {
      throw new Error(
        `Duplicate SeethingSwarm animation policy: ${policy.animationId}`,
      )
    }
    policiesById.set(policy.animationId, policy)
  }

  return policiesById
}

const battleAnimationPolicyById = createBattleAnimationPolicyById()

export function resolveSeethingSwarmBattleAnimationPolicy(animationId: string) {
  const policy = battleAnimationPolicyById.get(
    animationId as SeethingSwarmSourceAnimationId,
  )
  if (!policy) {
    throw new Error(`Missing SeethingSwarm animation policy: ${animationId}`)
  }
  return policy
}
