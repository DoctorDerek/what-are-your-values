import type { ZooAnimalId } from "./ZooAnimals"

const normalizedSourceIdPattern = /^[a-z0-9]+(?:_[a-z0-9]+)*$/

export type SeethingSwarmCharacterAnimationInput = Readonly<{
  animationId: string
  relativePath: string
  frameCount: number
}>

export type SeethingSwarmAuxiliaryEffectInput = Readonly<{
  effectId: string
  relativePath: string
  frameWidth: number
  frameHeight: number
  frameCount: number
}>

export type SeethingSwarmAnimalManifestInput = Readonly<{
  animalId: ZooAnimalId
  familyId: string
  sourceRelativePath: string
  sourceColorLabel: string
  frameWidth: number
  frameHeight: number
  animations: readonly SeethingSwarmCharacterAnimationInput[]
  auxiliaryEffects?: readonly SeethingSwarmAuxiliaryEffectInput[]
  evidenceSnapshotId: string
}>

export type SeethingSwarmCharacterAnimation = Readonly<{
  relativePath: string
  frameCount: number
}>

export type SeethingSwarmAuxiliaryEffect = Readonly<{
  relativePath: string
  frameWidth: number
  frameHeight: number
  frameCount: number
}>

export type SeethingSwarmAnimalManifest = Readonly<{
  animalId: ZooAnimalId
  familyId: string
  sourceRelativePath: string
  sourceColorLabel: string
  frameWidth: number
  frameHeight: number
  animations: Readonly<Record<string, SeethingSwarmCharacterAnimation>>
  auxiliaryEffects?: Readonly<Record<string, SeethingSwarmAuxiliaryEffect>>
  evidenceSnapshotId: string
}>

function assertNonEmptyText(value: string, label: string) {
  if (value.trim() === "") throw new Error(`Invalid ${label}: empty text`)
}

function assertNormalizedSourceId(value: string, label: string) {
  if (!normalizedSourceIdPattern.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

function assertPositiveSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

function assertRelativePath(value: string, label: string) {
  const segments = value.split("/")
  if (
    value === "" ||
    value.includes("\\") ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

function assertRelativePngPath(value: string, label: string) {
  assertRelativePath(value, label)
  if (!value.endsWith(".png")) throw new Error(`Invalid ${label}: ${value}`)
}

function assertUniqueNormalizedIds(ids: readonly string[], label: string) {
  const comparableIds = new Set<string>()
  for (const id of ids) {
    const comparableId = id.toLowerCase()
    if (comparableIds.has(comparableId)) {
      throw new Error(`Duplicate ${label}: ${id}`)
    }

    assertNormalizedSourceId(id, label)
    comparableIds.add(comparableId)
  }
}

function assertUniqueRelativePaths(paths: readonly string[]) {
  const comparablePaths = new Set<string>()
  for (const path of paths) {
    const comparablePath = path.toLowerCase()
    if (comparablePaths.has(comparablePath)) {
      throw new Error(`Duplicate asset path: ${path}`)
    }

    comparablePaths.add(comparablePath)
  }
}

function createFrozenRecord<Value>(
  entries: readonly (readonly [string, Value])[],
) {
  return Object.freeze(Object.fromEntries(entries)) as Readonly<
    Record<string, Value>
  >
}

function createCharacterAnimations(
  inputs: readonly SeethingSwarmCharacterAnimationInput[],
) {
  assertUniqueNormalizedIds(
    inputs.map(({ animationId }) => animationId),
    "character animation ID",
  )

  return createFrozenRecord(
    inputs.map(({ animationId, relativePath, frameCount }) => {
      assertRelativePngPath(relativePath, "character animation path")
      assertPositiveSafeInteger(frameCount, "character animation frame count")

      return [animationId, Object.freeze({ relativePath, frameCount })] as const
    }),
  )
}

function createAuxiliaryEffects(
  inputs: readonly SeethingSwarmAuxiliaryEffectInput[],
) {
  assertUniqueNormalizedIds(
    inputs.map(({ effectId }) => effectId),
    "auxiliary effect ID",
  )

  return createFrozenRecord(
    inputs.map(
      ({ effectId, relativePath, frameWidth, frameHeight, frameCount }) => {
        assertRelativePngPath(relativePath, "auxiliary effect path")
        assertPositiveSafeInteger(frameWidth, "auxiliary effect frame width")
        assertPositiveSafeInteger(frameHeight, "auxiliary effect frame height")
        assertPositiveSafeInteger(frameCount, "auxiliary effect frame count")

        return [
          effectId,
          Object.freeze({
            relativePath,
            frameWidth,
            frameHeight,
            frameCount,
          }),
        ] as const
      },
    ),
  )
}

export function createSeethingSwarmAnimalManifest(
  input: SeethingSwarmAnimalManifestInput,
) {
  assertNormalizedSourceId(input.familyId, "animal family ID")
  assertRelativePath(input.sourceRelativePath, "animal source path")
  assertNonEmptyText(input.sourceColorLabel, "source color label")
  assertPositiveSafeInteger(input.frameWidth, "character frame width")
  assertPositiveSafeInteger(input.frameHeight, "character frame height")
  assertNonEmptyText(input.evidenceSnapshotId, "evidence snapshot ID")

  const animations = createCharacterAnimations(input.animations)
  const auxiliaryEffects = input.auxiliaryEffects
    ? createAuxiliaryEffects(input.auxiliaryEffects)
    : undefined

  assertUniqueRelativePaths([
    ...Object.values(animations).map(({ relativePath }) => relativePath),
    ...Object.values(auxiliaryEffects ?? {}).map(
      ({ relativePath }) => relativePath,
    ),
  ])

  return Object.freeze({
    animalId: input.animalId,
    familyId: input.familyId,
    sourceRelativePath: input.sourceRelativePath,
    sourceColorLabel: input.sourceColorLabel,
    frameWidth: input.frameWidth,
    frameHeight: input.frameHeight,
    animations,
    ...(auxiliaryEffects ? { auxiliaryEffects } : {}),
    evidenceSnapshotId: input.evidenceSnapshotId,
  }) satisfies SeethingSwarmAnimalManifest
}
