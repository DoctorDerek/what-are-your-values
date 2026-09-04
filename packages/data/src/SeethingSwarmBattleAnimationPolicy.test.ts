import { describe, expect, it } from "vitest"
import {
  resolveSeethingSwarmBattleAnimationPolicy,
  SEETHING_SWARM_BATTLE_ANIMATION_POLICIES,
  SEETHING_SWARM_BATTLE_CLIP_USAGE_KINDS,
  SEETHING_SWARM_BATTLE_SEMANTIC_FAMILIES,
  type SeethingSwarmBattleEligibleAnimationPolicy,
} from "./SeethingSwarmBattleAnimationPolicy"
import { SEETHING_SWARM_SOURCE_SNAPSHOT } from "./SeethingSwarmSourceEvidence"

const EXPECTED_SOURCE_ANIMATION_IDS = Object.freeze([
  "alerted",
  "attack",
  "attack_air",
  "attack_ground",
  "attack01",
  "attack02",
  "attackdiagonal",
  "attackforward",
  "attackup",
  "bark",
  "bite",
  "call",
  "croak",
  "crouch",
  "dance",
  "dash",
  "die",
  "display",
  "eat",
  "fall",
  "fly",
  "fly_forward",
  "fly_idle",
  "fly_idle01",
  "fly_idle02",
  "fright",
  "growl",
  "hide",
  "hop",
  "howl",
  "hurt",
  "idle",
  "idle_blink",
  "idle_call",
  "idle_caw",
  "idle_laugh",
  "idle_upright",
  "idle_upright_blink",
  "idle_upsidedown",
  "idle_upsidedown_blink",
  "idle02",
  "idle02_blink",
  "jump",
  "land",
  "land_upright",
  "land_upsidedown",
  "ledgeclimb",
  "ledgeclimb_struggle",
  "ledgegrab",
  "ledgeidle",
  "liedown",
  "liedown_getup",
  "liedown_godown",
  "liedown_idle",
  "peck",
  "run",
  "sit",
  "sit_blink",
  "sit_call",
  "sit_caw",
  "sit_howl",
  "sit_leanback",
  "sit_leanback_eat",
  "sit_leanback_laugh",
  "sit_leanforward",
  "sit01",
  "sit02",
  "sleep",
  "sneak",
  "sniff",
  "soar",
  "soar_call",
  "stand",
  "swim",
  "swim_forward",
  "swim_idle",
  "swimattackdiagonal",
  "swimattackforward",
  "swimattackup",
  "swimforward",
  "swimidle",
  "takeoff",
  "unhide",
  "walk",
  "wallclimb",
  "wallgrab",
])

const EXPECTED_ENVIRONMENT_GATED_ANIMATION_IDS = Object.freeze([
  "eat",
  "idle_upsidedown",
  "idle_upsidedown_blink",
  "land_upsidedown",
  "ledgeclimb",
  "ledgeclimb_struggle",
  "ledgegrab",
  "ledgeidle",
  "sit_leanback_eat",
  "sleep",
  "swim",
  "swim_forward",
  "swim_idle",
  "swimattackdiagonal",
  "swimattackforward",
  "swimattackup",
  "swimforward",
  "swimidle",
  "wallclimb",
  "wallgrab",
])

function getBattleEligiblePolicies() {
  return SEETHING_SWARM_BATTLE_ANIMATION_POLICIES.filter(
    (policy): policy is SeethingSwarmBattleEligibleAnimationPolicy =>
      policy.usageKind === "battle-eligible",
  )
}

describe("SeethingSwarm battle animation policy", () => {
  it("classifies the exact audited source animation vocabulary once", () => {
    const policyAnimationIds = SEETHING_SWARM_BATTLE_ANIMATION_POLICIES.map(
      ({ animationId }) => animationId,
    )

    expect(policyAnimationIds).toHaveLength(
      SEETHING_SWARM_SOURCE_SNAPSHOT.distinctAnimationIdCount,
    )
    expect(new Set(policyAnimationIds).size).toBe(policyAnimationIds.length)
    expect(policyAnimationIds.toSorted()).toEqual(
      EXPECTED_SOURCE_ANIMATION_IDS.toSorted(),
    )
  })

  it("keeps routine, contextual, and terminal policies disjoint", () => {
    const policiesByUsageKind = Object.fromEntries(
      SEETHING_SWARM_BATTLE_CLIP_USAGE_KINDS.map((usageKind) => [
        usageKind,
        SEETHING_SWARM_BATTLE_ANIMATION_POLICIES.filter(
          (policy) => policy.usageKind === usageKind,
        ),
      ]),
    )

    expect(policiesByUsageKind["battle-eligible"]).toHaveLength(65)
    expect(
      policiesByUsageKind["environment-gated"].map(
        ({ animationId }) => animationId,
      ),
    ).toEqual(EXPECTED_ENVIRONMENT_GATED_ANIMATION_IDS)
    expect(policiesByUsageKind["terminal-disabled"]).toEqual([
      expect.objectContaining({ animationId: "die" }),
    ])
  })

  it("assigns every eligible clip at least one supported semantic family", () => {
    const battleEligiblePolicies = getBattleEligiblePolicies()
    const assignedSemanticFamilies = new Set(
      battleEligiblePolicies.flatMap(
        ({ semanticFamilies }) => semanticFamilies,
      ),
    )

    expect(
      battleEligiblePolicies.every(
        ({ semanticFamilies }) => semanticFamilies.length > 0,
      ),
    ).toBe(true)
    expect([...assignedSemanticFamilies].toSorted()).toEqual(
      [...SEETHING_SWARM_BATTLE_SEMANTIC_FAMILIES].toSorted(),
    )
    expect(
      SEETHING_SWARM_BATTLE_ANIMATION_POLICIES.filter(
        ({ usageKind }) => usageKind !== "battle-eligible",
      ).every((policy) => !("semanticFamilies" in policy)),
    ).toBe(true)
  })

  it("preserves representative tone and environment decisions", () => {
    expect(resolveSeethingSwarmBattleAnimationPolicy("idle")).toMatchObject({
      usageKind: "battle-eligible",
      semanticFamilies: ["rest"],
    })
    expect(
      resolveSeethingSwarmBattleAnimationPolicy("attack_air"),
    ).toMatchObject({
      usageKind: "battle-eligible",
      semanticFamilies: ["attack"],
    })
    expect(resolveSeethingSwarmBattleAnimationPolicy("hurt")).toMatchObject({
      usageKind: "battle-eligible",
      semanticFamilies: ["reaction"],
    })
    expect(resolveSeethingSwarmBattleAnimationPolicy("dance")).toMatchObject({
      usageKind: "battle-eligible",
      semanticFamilies: ["celebration"],
    })
    expect(resolveSeethingSwarmBattleAnimationPolicy("wallgrab")).toEqual({
      animationId: "wallgrab",
      usageKind: "environment-gated",
    })
    expect(resolveSeethingSwarmBattleAnimationPolicy("swimattackup")).toEqual({
      animationId: "swimattackup",
      usageKind: "environment-gated",
    })
    expect(resolveSeethingSwarmBattleAnimationPolicy("die")).toEqual({
      animationId: "die",
      usageKind: "terminal-disabled",
    })
  })

  it("returns canonical immutable policies and rejects unknown clips", () => {
    for (const policy of SEETHING_SWARM_BATTLE_ANIMATION_POLICIES) {
      expect(
        resolveSeethingSwarmBattleAnimationPolicy(policy.animationId),
      ).toBe(policy)
      expect(Object.isFrozen(policy)).toBe(true)
      if (policy.usageKind === "battle-eligible") {
        expect(Object.isFrozen(policy.semanticFamilies)).toBe(true)
      }
    }

    expect(Object.isFrozen(SEETHING_SWARM_BATTLE_ANIMATION_POLICIES)).toBe(true)
    expect(Object.isFrozen(SEETHING_SWARM_BATTLE_CLIP_USAGE_KINDS)).toBe(true)
    expect(Object.isFrozen(SEETHING_SWARM_BATTLE_SEMANTIC_FAMILIES)).toBe(true)
    expect(() => resolveSeethingSwarmBattleAnimationPolicy("unknown")).toThrow(
      "Missing SeethingSwarm animation policy: unknown",
    )
  })
})
