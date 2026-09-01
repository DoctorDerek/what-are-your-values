import { splitGraphemes } from "unicode-segmenter/grapheme"
import type { SeethingSwarmAnimalRegistry } from "./SeethingSwarmAnimalRegistry"
import type { ActiveValueDefinition } from "./Value"
import { VALUE_TO_ANIMAL_MAP } from "./ValueToAnimalMap"
import { ZOO_ANIMALS, type ZooAnimalId } from "./ZooAnimals"

export const SEETHING_SWARM_HUB_ANIMATION_CANDIDATES = Object.freeze([
  "idle",
  "idle_upright",
] as const)
export const SEETHING_SWARM_HUB_TILE_SIZE = 72
export const SEETHING_SWARM_HUB_FRAME_DURATION_MS = 160

export type SeethingSwarmHubAnimationId =
  (typeof SEETHING_SWARM_HUB_ANIMATION_CANDIDATES)[number]

export type SeethingSwarmVisibleContentBounds = Readonly<{
  left: number
  top: number
  width: number
  height: number
}>

export type SeethingSwarmAnimalPresentationGeometry = Readonly<{
  visibleBounds: SeethingSwarmVisibleContentBounds
  integerScale: number
  frameOffsetX: number
  frameOffsetY: number
}>

export type SeethingSwarmHubAnimationSelection = Readonly<{
  animalId: ZooAnimalId
  animationId: SeethingSwarmHubAnimationId
  relativePath: string
  frameWidth: number
  frameHeight: number
  frameCount: number
}>

export type SeethingSwarmAnimalPresentation<PlatformAsset> = Readonly<
  SeethingSwarmHubAnimationSelection &
    SeethingSwarmAnimalPresentationGeometry & {
      asset: PlatformAsset
    }
>

export type SeethingSwarmLicensedAnimalPresentationAdapter<PlatformAsset> =
  Readonly<{
    mode: "licensed"
    evidenceSnapshotId: string
    animals: readonly SeethingSwarmAnimalPresentation<PlatformAsset>[]
  }>

export type SeethingSwarmTypographyOnlyAnimalPresentationAdapter = Readonly<{
  mode: "typography-only"
}>

export type SeethingSwarmAnimalPresentationAdapter<PlatformAsset> =
  | SeethingSwarmLicensedAnimalPresentationAdapter<PlatformAsset>
  | SeethingSwarmTypographyOnlyAnimalPresentationAdapter

export type ValueAnimalPresentation<PlatformAsset> =
  | Readonly<{
      kind: "animal"
      animal: SeethingSwarmAnimalPresentation<PlatformAsset>
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

function assertNonNegativeSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

function freezeVisibleBounds(
  bounds: SeethingSwarmVisibleContentBounds,
  frameWidth: number,
  frameHeight: number,
) {
  assertNonNegativeSafeInteger(bounds.left, "visible-content left edge")
  assertNonNegativeSafeInteger(bounds.top, "visible-content top edge")
  assertPositiveSafeInteger(bounds.width, "visible-content width")
  assertPositiveSafeInteger(bounds.height, "visible-content height")

  if (
    bounds.left + bounds.width > frameWidth ||
    bounds.top + bounds.height > frameHeight
  ) {
    throw new Error(
      `Visible SeethingSwarm content exceeds its ${frameWidth}x${frameHeight} frame`,
    )
  }

  return Object.freeze({ ...bounds })
}

export function createSeethingSwarmAnimalPresentationGeometry(
  frameWidth: number,
  frameHeight: number,
  visibleBounds: SeethingSwarmVisibleContentBounds,
) {
  assertPositiveSafeInteger(frameWidth, "SeethingSwarm frame width")
  assertPositiveSafeInteger(frameHeight, "SeethingSwarm frame height")
  const frozenVisibleBounds = freezeVisibleBounds(
    visibleBounds,
    frameWidth,
    frameHeight,
  )
  const integerScale = Math.floor(
    Math.min(
      SEETHING_SWARM_HUB_TILE_SIZE / frozenVisibleBounds.width,
      SEETHING_SWARM_HUB_TILE_SIZE / frozenVisibleBounds.height,
    ),
  )
  if (integerScale < 1) {
    throw new Error(
      `Visible SeethingSwarm content cannot fit the ${SEETHING_SWARM_HUB_TILE_SIZE}-unit Hub tile`,
    )
  }

  const scaledVisibleWidth = frozenVisibleBounds.width * integerScale
  const frameOffsetX =
    Math.floor((SEETHING_SWARM_HUB_TILE_SIZE - scaledVisibleWidth) / 2) -
    frozenVisibleBounds.left * integerScale
  const frameOffsetY =
    SEETHING_SWARM_HUB_TILE_SIZE -
    (frozenVisibleBounds.top + frozenVisibleBounds.height) * integerScale

  return Object.freeze({
    visibleBounds: frozenVisibleBounds,
    integerScale,
    frameOffsetX,
    frameOffsetY,
  }) satisfies SeethingSwarmAnimalPresentationGeometry
}

function getCalmAnimation(
  animal: SeethingSwarmAnimalRegistry["animals"][number],
) {
  for (const animationId of SEETHING_SWARM_HUB_ANIMATION_CANDIDATES) {
    const animation = animal.animations[animationId]
    if (animation) return Object.freeze({ animationId, animation })
  }

  throw new Error(
    `Missing calm SeethingSwarm Hub animation for ${animal.animalId}`,
  )
}

export function selectSeethingSwarmHubAnimations(
  registry: SeethingSwarmAnimalRegistry,
) {
  if (registry.animals.length !== ZOO_ANIMALS.length) {
    throw new Error(
      `Invalid SeethingSwarm Hub animal count: ${registry.animals.length}`,
    )
  }

  return Object.freeze(
    ZOO_ANIMALS.map(({ id }, index) => {
      const animal = registry.animals[index]
      if (animal?.animalId !== id) {
        throw new Error(
          `Invalid SeethingSwarm Hub animal at position ${index}: expected ${id}, received ${animal?.animalId ?? "missing"}`,
        )
      }

      const { animationId, animation } = getCalmAnimation(animal)
      return Object.freeze({
        animalId: animal.animalId,
        animationId,
        relativePath: animation.relativePath,
        frameWidth: animal.frameWidth,
        frameHeight: animal.frameHeight,
        frameCount: animation.frameCount,
      }) satisfies SeethingSwarmHubAnimationSelection
    }),
  )
}

function assertMatchingPresentation<PlatformAsset>(
  expected: SeethingSwarmHubAnimationSelection,
  presentation: SeethingSwarmAnimalPresentation<PlatformAsset> | undefined,
  index: number,
) {
  if (!presentation) {
    throw new Error(
      `Missing SeethingSwarm Hub presentation at position ${index}`,
    )
  }

  for (const property of [
    "animalId",
    "animationId",
    "relativePath",
    "frameWidth",
    "frameHeight",
    "frameCount",
  ] as const) {
    if (presentation[property] !== expected[property]) {
      throw new Error(
        `Invalid SeethingSwarm Hub ${property} at position ${index}: expected ${expected[property]}, received ${presentation[property]}`,
      )
    }
  }
  if (presentation.asset === null || presentation.asset === undefined) {
    throw new Error(`Missing SeethingSwarm Hub asset: ${expected.relativePath}`)
  }

  const expectedGeometry = createSeethingSwarmAnimalPresentationGeometry(
    expected.frameWidth,
    expected.frameHeight,
    presentation.visibleBounds,
  )
  for (const property of [
    "integerScale",
    "frameOffsetX",
    "frameOffsetY",
  ] as const) {
    if (presentation[property] !== expectedGeometry[property]) {
      throw new Error(
        `Invalid SeethingSwarm Hub ${property} for ${expected.animalId}: expected ${expectedGeometry[property]}, received ${presentation[property]}`,
      )
    }
  }
}

export function createSeethingSwarmLicensedAnimalPresentationAdapter<
  PlatformAsset,
>(
  registry: SeethingSwarmAnimalRegistry,
  presentations: readonly SeethingSwarmAnimalPresentation<PlatformAsset>[],
) {
  const selections = selectSeethingSwarmHubAnimations(registry)
  if (presentations.length !== selections.length) {
    throw new Error(
      `Invalid SeethingSwarm Hub presentation count: expected ${selections.length}, received ${presentations.length}`,
    )
  }

  selections.forEach((selection, index) =>
    assertMatchingPresentation(selection, presentations[index], index),
  )

  return Object.freeze({
    mode: "licensed",
    evidenceSnapshotId: registry.evidenceSnapshotId,
    animals: Object.freeze(
      presentations.map((presentation) =>
        Object.freeze({
          ...presentation,
          visibleBounds: Object.freeze({ ...presentation.visibleBounds }),
        }),
      ),
    ),
  }) satisfies SeethingSwarmLicensedAnimalPresentationAdapter<PlatformAsset>
}

export function createSeethingSwarmTypographyOnlyAnimalPresentationAdapter() {
  return Object.freeze({
    mode: "typography-only",
  }) satisfies SeethingSwarmTypographyOnlyAnimalPresentationAdapter
}

function getCustomValueInitial(valueName: string) {
  const initial = splitGraphemes(valueName.trim()).next().value
  if (!initial) throw new Error("Custom Value name must contain one grapheme")
  return initial
}

export function resolveValueAnimalPresentation<PlatformAsset>(
  value: ActiveValueDefinition,
  adapter: SeethingSwarmAnimalPresentationAdapter<PlatformAsset>,
): ValueAnimalPresentation<PlatformAsset> {
  if (adapter.mode === "typography-only") {
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
  const animal = adapter.animals.find(
    (presentation) => presentation.animalId === animalId,
  )
  if (!animal) {
    throw new Error(
      `Missing animal presentation for canonical value: ${value.id}`,
    )
  }

  return Object.freeze({ kind: "animal", animal })
}
