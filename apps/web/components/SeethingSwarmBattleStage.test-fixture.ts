import type {
  SeethingSwarmLicensedRuntimeClipCatalog,
  SeethingSwarmRuntimeCharacterClip,
} from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import type { ZooAnimalId } from "@game/data/src/ZooAnimals"
import type { PresentedBattle } from "@game/machines/src/CombatMachine"
import { resolveSeethingSwarmBattleCombatant } from "@game/machines/src/SeethingSwarmBattleCombatant"
import type { StaticImageData } from "next/image"

const TEST_ANIMATION_IDS = Object.freeze([
  "idle",
  "alerted",
  "attack",
  "hurt",
  "dance",
  "run",
] as const)

function createTestClip(
  animalId: ZooAnimalId,
  animationId: (typeof TEST_ANIMATION_IDS)[number],
) {
  const frameWidth = 32
  const frameHeight = 32
  const frameCount = 4

  return Object.freeze({
    kind: "character",
    animalId,
    animationId,
    relativePath: `${animalId}/${animationId}_strip${frameCount}.png`,
    frameWidth,
    frameHeight,
    frameCount,
    visibleBounds: Object.freeze({
      left: 0,
      top: 0,
      width: frameWidth,
      height: frameHeight,
    }),
    asset: Object.freeze({
      src: `/test-assets/${animalId}/${animationId}.png`,
      width: frameWidth * frameCount,
      height: frameHeight,
    }),
  }) satisfies SeethingSwarmRuntimeCharacterClip<StaticImageData>
}

export function createSeethingSwarmBattleStageTestCatalog(
  ...battles: readonly PresentedBattle[]
) {
  const animalIds = [
    ...new Set(
      battles.flatMap(({ pair }) =>
        pair.map(
          (valueId) => resolveSeethingSwarmBattleCombatant(valueId).animalId,
        ),
      ),
    ),
  ]
  const animals = animalIds.map((animalId) =>
    Object.freeze({
      animalId,
      characterClips: Object.freeze(
        TEST_ANIMATION_IDS.map((animationId) =>
          createTestClip(animalId, animationId),
        ),
      ),
      auxiliaryEffectClips: Object.freeze([]),
    }),
  )

  return Object.freeze({
    mode: "licensed",
    evidenceSnapshotId: "battle-stage-test",
    animals: Object.freeze(animals),
    characterClipCount: animals.length * TEST_ANIMATION_IDS.length,
    auxiliaryEffectClipCount: 0,
  }) satisfies SeethingSwarmLicensedRuntimeClipCatalog<StaticImageData>
}
