import {
  resolveSeethingSwarmBattleAnimationPolicy,
  type SeethingSwarmBattleEligibleAnimationPolicy,
  type SeethingSwarmBattleSemanticFamily,
} from "@game/data/src/SeethingSwarmBattleAnimationPolicy"
import { resolveSeethingSwarmBattleSequence } from "@game/data/src/SeethingSwarmBattleSequencePolicy"
import type {
  SeethingSwarmLicensedRuntimeClipCatalog,
  SeethingSwarmRuntimeAnimalClips,
  SeethingSwarmRuntimeCharacterClip,
  SeethingSwarmRuntimeClipCatalog,
} from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import type { ValueId } from "@game/data/src/Value"
import type { ZooAnimalId } from "@game/data/src/ZooAnimals"
import type { BattleSchedulerRestorePoint } from "./BattleScheduler"
import type { PresentedBattle } from "./CombatMachine"
import { hashText } from "./DeterministicSequence"
import {
  resolveSeethingSwarmBattleCombatant,
  type SeethingSwarmBattleCombatant,
} from "./SeethingSwarmBattleCombatant"

export const SEETHING_SWARM_BATTLE_CHOREOGRAPHY_VERSION = 2

export const SEETHING_SWARM_BATTLE_COMBATANT_SIDES = Object.freeze([
  "first",
  "second",
] as const)

export type SeethingSwarmBattleCombatantSide =
  (typeof SEETHING_SWARM_BATTLE_COMBATANT_SIDES)[number]

function defineBattleClipRolePolicy<const Role extends string>(
  role: Role,
  ...semanticFamilyPriorities: readonly SeethingSwarmBattleSemanticFamily[]
) {
  return Object.freeze({
    role,
    semanticFamilyPriorities: Object.freeze(semanticFamilyPriorities),
  })
}

export const SEETHING_SWARM_BATTLE_CLIP_ROLE_POLICIES = Object.freeze([
  defineBattleClipRolePolicy("entry", "entry-exit", "anticipation", "rest"),
  defineBattleClipRolePolicy("rest", "rest", "anticipation", "entry-exit"),
  defineBattleClipRolePolicy("anticipation", "anticipation", "rest"),
  defineBattleClipRolePolicy(
    "attack",
    "attack",
    "anticipation",
    "entry-exit",
    "rest",
  ),
  defineBattleClipRolePolicy("reaction", "reaction", "anticipation", "rest"),
  defineBattleClipRolePolicy("flourish", "celebration", "anticipation", "rest"),
])

export type SeethingSwarmBattleClipRole =
  (typeof SEETHING_SWARM_BATTLE_CLIP_ROLE_POLICIES)[number]["role"]

export type SeethingSwarmBattleClipSelection<PlatformAsset> = Readonly<{
  role: SeethingSwarmBattleClipRole
  semanticFamily: SeethingSwarmBattleSemanticFamily
  clip: SeethingSwarmRuntimeCharacterClip<PlatformAsset>
  sequence: readonly SeethingSwarmRuntimeCharacterClip<PlatformAsset>[]
}>

export type SeethingSwarmBattleClipSelections<PlatformAsset> = Readonly<{
  entry: SeethingSwarmBattleClipSelection<PlatformAsset>
  rest: SeethingSwarmBattleClipSelection<PlatformAsset>
  anticipation: SeethingSwarmBattleClipSelection<PlatformAsset>
  attack: SeethingSwarmBattleClipSelection<PlatformAsset>
  reaction: SeethingSwarmBattleClipSelection<PlatformAsset>
  flourish: SeethingSwarmBattleClipSelection<PlatformAsset>
}>

export type SeethingSwarmLicensedBattleCombatant<PlatformAsset> =
  SeethingSwarmBattleCombatant &
    Readonly<{
      side: SeethingSwarmBattleCombatantSide
      clips: SeethingSwarmBattleClipSelections<PlatformAsset>
    }>

export type SeethingSwarmPlaceholderBattleCombatant =
  SeethingSwarmBattleCombatant &
    Readonly<{
      side: SeethingSwarmBattleCombatantSide
    }>

export type SeethingSwarmLicensedBattleChoreography<PlatformAsset> = Readonly<{
  mode: "licensed"
  choreographyIdentity: string
  combatants: readonly [
    SeethingSwarmLicensedBattleCombatant<PlatformAsset>,
    SeethingSwarmLicensedBattleCombatant<PlatformAsset>,
  ]
}>

export type SeethingSwarmPlaceholderBattleChoreography = Readonly<{
  mode: "placeholder"
  choreographyIdentity: string
  combatants: readonly [
    SeethingSwarmPlaceholderBattleCombatant,
    SeethingSwarmPlaceholderBattleCombatant,
  ]
}>

export type SeethingSwarmBattleChoreography<PlatformAsset> =
  | SeethingSwarmLicensedBattleChoreography<PlatformAsset>
  | SeethingSwarmPlaceholderBattleChoreography

type ClassifiedBattleEligibleClip<PlatformAsset> = Readonly<{
  clip: SeethingSwarmRuntimeCharacterClip<PlatformAsset>
  policy: SeethingSwarmBattleEligibleAnimationPolicy
}>

function compareText(first: string, second: string) {
  if (first < second) return -1
  if (first > second) return 1
  return 0
}

function createChoreographyIdentity(battle: PresentedBattle) {
  const { scheduler } = battle
  return JSON.stringify([
    "seethingswarm-battle-choreography",
    SEETHING_SWARM_BATTLE_CHOREOGRAPHY_VERSION,
    scheduler.algorithmVersion,
    scheduler.activeDeckFingerprint,
    scheduler.progressGeneration,
    scheduler.deckRevision,
    scheduler.scheduleKind,
    scheduler.seed,
    scheduler.cycleIndex,
    scheduler.cursor,
    battle.pair,
  ])
}

function resolveRuntimeAnimalClips<PlatformAsset>(
  catalog: SeethingSwarmLicensedRuntimeClipCatalog<PlatformAsset>,
  animalId: ZooAnimalId,
) {
  const animal = catalog.animals.find(
    (candidate) => candidate.animalId === animalId,
  )
  if (!animal) {
    throw new Error(`Missing battle animation catalog for animal: ${animalId}`)
  }
  return animal
}

function classifyBattleEligibleClips<PlatformAsset>(
  animal: SeethingSwarmRuntimeAnimalClips<PlatformAsset>,
) {
  const battleEligibleClips: ClassifiedBattleEligibleClip<PlatformAsset>[] = []
  for (const clip of animal.characterClips) {
    const policy = resolveSeethingSwarmBattleAnimationPolicy(clip.animationId)
    if (policy.usageKind === "battle-eligible") {
      battleEligibleClips.push(Object.freeze({ clip, policy }))
    }
  }

  return Object.freeze(battleEligibleClips)
}

function resolveRolePolicy(role: SeethingSwarmBattleClipRole) {
  const policy = SEETHING_SWARM_BATTLE_CLIP_ROLE_POLICIES.find(
    (candidate) => candidate.role === role,
  )
  if (!policy) {
    throw new Error(`Missing SeethingSwarm battle clip role: ${role}`)
  }
  return policy
}

function createStableSelectionOffset({
  scheduler,
  combatant,
  side,
  role,
}: {
  readonly scheduler: BattleSchedulerRestorePoint
  readonly combatant: SeethingSwarmBattleCombatant
  readonly side: SeethingSwarmBattleCombatantSide
  readonly role: SeethingSwarmBattleClipRole
}) {
  return hashText(
    JSON.stringify([
      "seethingswarm-battle-clip-selection",
      SEETHING_SWARM_BATTLE_CHOREOGRAPHY_VERSION,
      scheduler.algorithmVersion,
      scheduler.activeDeckFingerprint,
      scheduler.progressGeneration,
      scheduler.deckRevision,
      scheduler.scheduleKind,
      scheduler.seed,
      combatant.valueId,
      combatant.animalId,
      side,
      role,
    ]),
  )
}

function selectBattleClip<PlatformAsset>({
  battleEligibleClips,
  availableClips,
  combatant,
  scheduler,
  side,
  role,
}: {
  readonly battleEligibleClips: readonly ClassifiedBattleEligibleClip<PlatformAsset>[]
  readonly availableClips: readonly SeethingSwarmRuntimeCharacterClip<PlatformAsset>[]
  readonly combatant: SeethingSwarmBattleCombatant
  readonly scheduler: BattleSchedulerRestorePoint
  readonly side: SeethingSwarmBattleCombatantSide
  readonly role: SeethingSwarmBattleClipRole
}) {
  const rolePolicy = resolveRolePolicy(role)
  for (const semanticFamily of rolePolicy.semanticFamilyPriorities) {
    const candidates = battleEligibleClips
      .filter(({ policy }) => policy.semanticFamilies.includes(semanticFamily))
      .flatMap(({ clip }) => {
        const sequence = resolveSeethingSwarmBattleSequence(
          clip,
          availableClips,
          role === "rest",
        )
        return sequence ? [{ clip, sequence }] : []
      })
      .toSorted((first, second) =>
        compareText(first.clip.animationId, second.clip.animationId),
      )
    if (candidates.length === 0) continue

    const stableOffset = createStableSelectionOffset({
      scheduler,
      combatant,
      side,
      role,
    })
    const selectedIndex =
      ((stableOffset % candidates.length) +
        (scheduler.cycleIndex % candidates.length) +
        (scheduler.cursor % candidates.length)) %
      candidates.length

    return Object.freeze({
      role,
      semanticFamily,
      clip: candidates[selectedIndex]!.clip,
      sequence: candidates[selectedIndex]!.sequence,
    }) satisfies SeethingSwarmBattleClipSelection<PlatformAsset>
  }

  throw new Error(
    `Missing battle-eligible ${role} animation for animal: ${combatant.animalId}`,
  )
}

function createLicensedBattleCombatant<PlatformAsset>({
  catalog,
  combatant,
  scheduler,
  side,
}: {
  readonly catalog: SeethingSwarmLicensedRuntimeClipCatalog<PlatformAsset>
  readonly combatant: SeethingSwarmBattleCombatant
  readonly scheduler: BattleSchedulerRestorePoint
  readonly side: SeethingSwarmBattleCombatantSide
}) {
  const animal = resolveRuntimeAnimalClips(catalog, combatant.animalId)
  const battleEligibleClips = classifyBattleEligibleClips(animal)
  const selectClip = (role: SeethingSwarmBattleClipRole) =>
    selectBattleClip({
      battleEligibleClips,
      availableClips: animal.characterClips,
      combatant,
      scheduler,
      side,
      role,
    })

  return Object.freeze({
    ...combatant,
    side,
    clips: Object.freeze({
      entry: selectClip("entry"),
      rest: selectClip("rest"),
      anticipation: selectClip("anticipation"),
      attack: selectClip("attack"),
      reaction: selectClip("reaction"),
      flourish: selectClip("flourish"),
    }),
  }) satisfies SeethingSwarmLicensedBattleCombatant<PlatformAsset>
}

function createPlaceholderBattleCombatant(
  combatant: SeethingSwarmBattleCombatant,
  side: SeethingSwarmBattleCombatantSide,
) {
  return Object.freeze({
    ...combatant,
    side,
  }) satisfies SeethingSwarmPlaceholderBattleCombatant
}

export function createSeethingSwarmBattleChoreography<PlatformAsset>({
  battle,
  catalog,
}: {
  readonly battle: PresentedBattle
  readonly catalog: SeethingSwarmRuntimeClipCatalog<PlatformAsset>
}): SeethingSwarmBattleChoreography<PlatformAsset> {
  const firstCombatant = resolveSeethingSwarmBattleCombatant(battle.pair[0])
  const secondCombatant = resolveSeethingSwarmBattleCombatant(battle.pair[1])
  const choreographyIdentity = createChoreographyIdentity(battle)

  if (catalog.mode === "typography-only") {
    return Object.freeze({
      mode: "placeholder",
      choreographyIdentity,
      combatants: Object.freeze([
        createPlaceholderBattleCombatant(firstCombatant, "first"),
        createPlaceholderBattleCombatant(secondCombatant, "second"),
      ] as const),
    })
  }

  return Object.freeze({
    mode: "licensed",
    choreographyIdentity,
    combatants: Object.freeze([
      createLicensedBattleCombatant({
        catalog,
        combatant: firstCombatant,
        scheduler: battle.scheduler,
        side: "first",
      }),
      createLicensedBattleCombatant({
        catalog,
        combatant: secondCombatant,
        scheduler: battle.scheduler,
        side: "second",
      }),
    ] as const),
  })
}

function resolveWinnerAndLoser<
  Combatant extends Readonly<{ valueId: ValueId }>,
>(
  combatants: readonly [Combatant, Combatant],
  winnerId: ValueId,
): Readonly<{ winner: Combatant; loser: Combatant }> {
  if (combatants[0].valueId === winnerId) {
    return Object.freeze({ winner: combatants[0], loser: combatants[1] })
  }
  if (combatants[1].valueId === winnerId) {
    return Object.freeze({ winner: combatants[1], loser: combatants[0] })
  }
  throw new Error(`Battle winner is not a presented combatant: ${winnerId}`)
}

export function resolveSeethingSwarmBattleResult<PlatformAsset>(
  choreography: SeethingSwarmBattleChoreography<PlatformAsset>,
  winnerId: ValueId,
) {
  if (choreography.mode === "licensed") {
    return Object.freeze({
      mode: "licensed",
      ...resolveWinnerAndLoser(choreography.combatants, winnerId),
    })
  }

  return Object.freeze({
    mode: "placeholder",
    ...resolveWinnerAndLoser(choreography.combatants, winnerId),
  })
}
