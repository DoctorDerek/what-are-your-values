import { splitGraphemes } from "unicode-segmenter/grapheme"
import {
  createSeethingSwarmVisibleContentBounds,
  SeethingSwarmRuntimeAnimalClips,
  SeethingSwarmRuntimeCharacterClip,
  SeethingSwarmRuntimeClipCatalog,
  SeethingSwarmVisibleContentBounds,
} from "./SeethingSwarmRuntimeClipCatalog"
import type { ActiveValueDefinition } from "./Value"
import { VALUE_TO_ANIMAL_MAP } from "./ValueToAnimalMap"
import type { ZooAnimalId } from "./ZooAnimals"

export const SEETHING_SWARM_HUB_ANIMATION_CANDIDATES = Object.freeze([
  "idle",
  "idle_upright",
] as const)
export const SEETHING_SWARM_HUB_TILE_SIZE = 72
export const SEETHING_SWARM_HUB_FRAME_DURATION_MS = 160
export const SEETHING_SWARM_BATTLE_RESULT_DURATION_MS = 480
export const SEETHING_SWARM_BATTLE_FRAME_DURATION_MS = 60
export const SEETHING_SWARM_BATTLE_TILE_SIZE = 112

export const SEETHING_SWARM_ANIMAL_PLAYBACK_MODES = Object.freeze([
  "loop",
  "one-shot",
  "hold-final-frame",
  "static",
] as const)

export type SeethingSwarmAnimalPlaybackMode =
  (typeof SEETHING_SWARM_ANIMAL_PLAYBACK_MODES)[number]

export const SEETHING_SWARM_ANIMAL_FACING_DIRECTIONS = Object.freeze([
  "left",
  "right",
] as const)

export type SeethingSwarmAnimalFacingDirection =
  (typeof SEETHING_SWARM_ANIMAL_FACING_DIRECTIONS)[number]

export type SeethingSwarmHubAnimationId =
  (typeof SEETHING_SWARM_HUB_ANIMATION_CANDIDATES)[number]

export type SeethingSwarmAnimalPresentationGeometry = Readonly<{
  visibleBounds: SeethingSwarmVisibleContentBounds
  integerScale: number
  frameOffsetX: number
  frameOffsetY: number
}>

export type ValueAnimalPresentation<PlatformAsset> =
  | Readonly<{
      kind: "animal"
      clip: SeethingSwarmRuntimeCharacterClip<PlatformAsset>
    }>
  | Readonly<{
      kind: "custom-initial"
      initial: string
    }>
  | Readonly<{
      kind: "typography-only"
    }>

const TYPOGRAPHY_ONLY_VALUE_PRESENTATION = Object.freeze({
  kind: "typography-only",
}) satisfies ValueAnimalPresentation<never>

function assertPositiveSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

export function createSeethingSwarmAnimalPresentationGeometry(
  frameWidth: number,
  frameHeight: number,
  visibleBounds: SeethingSwarmVisibleContentBounds,
  tileSize = SEETHING_SWARM_HUB_TILE_SIZE,
  maximumIntegerScale?: number,
) {
  assertPositiveSafeInteger(frameWidth, "SeethingSwarm frame width")
  assertPositiveSafeInteger(frameHeight, "SeethingSwarm frame height")
  assertPositiveSafeInteger(tileSize, "SeethingSwarm tile size")
  const frozenVisibleBounds = createSeethingSwarmVisibleContentBounds(
    frameWidth,
    frameHeight,
    visibleBounds,
  )
  if (maximumIntegerScale !== undefined)
    assertPositiveSafeInteger(
      maximumIntegerScale,
      "SeethingSwarm maximum scale",
    )
  const integerScale = Math.min(
    maximumIntegerScale ?? Infinity,
    Math.floor(
      Math.min(
        tileSize / frozenVisibleBounds.width,
        tileSize / frozenVisibleBounds.height,
      ),
    ),
  )
  if (integerScale < 1) {
    throw new Error(
      `Visible SeethingSwarm content cannot fit the ${tileSize}-unit tile`,
    )
  }

  const scaledVisibleWidth = frozenVisibleBounds.width * integerScale
  const frameOffsetX =
    Math.floor((tileSize - scaledVisibleWidth) / 2) -
    frozenVisibleBounds.left * integerScale
  const frameOffsetY =
    tileSize -
    (frozenVisibleBounds.top + frozenVisibleBounds.height) * integerScale

  return Object.freeze({
    visibleBounds: frozenVisibleBounds,
    integerScale,
    frameOffsetX,
    frameOffsetY,
  }) satisfies SeethingSwarmAnimalPresentationGeometry
}

function resolveCalmAnimalClip<PlatformAsset>(
  animal: SeethingSwarmRuntimeAnimalClips<PlatformAsset>,
) {
  for (const animationId of SEETHING_SWARM_HUB_ANIMATION_CANDIDATES) {
    const clip = animal.characterClips.find(
      (candidate) => candidate.animationId === animationId,
    )
    if (clip) return clip
  }

  throw new Error(
    `Missing calm SeethingSwarm Hub animation for ${animal.animalId}`,
  )
}

function resolveAnimalClips<PlatformAsset>(
  catalog: Extract<
    SeethingSwarmRuntimeClipCatalog<PlatformAsset>,
    { mode: "licensed" }
  >,
  animalId: ZooAnimalId,
) {
  const animal = catalog.animals.find(
    (candidate) => candidate.animalId === animalId,
  )
  if (!animal) {
    throw new Error(`Missing animal presentation for animal: ${animalId}`)
  }
  return animal
}

function getCustomValueInitial(valueName: string) {
  const initial = splitGraphemes(valueName.trim()).next().value
  if (!initial) throw new Error("Custom Value name must contain one grapheme")
  return initial
}

export function resolveValueAnimalPresentation<PlatformAsset>(
  value: ActiveValueDefinition,
  catalog: SeethingSwarmRuntimeClipCatalog<PlatformAsset>,
): ValueAnimalPresentation<PlatformAsset> {
  if (catalog.mode === "typography-only") {
    return TYPOGRAPHY_ONLY_VALUE_PRESENTATION
  }
  if (value.kind === "custom") {
    return Object.freeze({
      kind: "custom-initial",
      initial: getCustomValueInitial(value.name),
    })
  }

  const animalId = VALUE_TO_ANIMAL_MAP.find(
    ({ valueId }) => valueId === value.id,
  )?.animalId
  if (!animalId) {
    throw new Error(`Missing animal mapping for canonical value: ${value.id}`)
  }

  return Object.freeze({
    kind: "animal",
    clip: resolveCalmAnimalClip(resolveAnimalClips(catalog, animalId)),
  })
}
