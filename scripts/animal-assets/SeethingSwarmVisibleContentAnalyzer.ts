import { createSeethingSwarmAnimalPresentationGeometry } from "#game/data/src/SeethingSwarmAnimalPresentation"
import type { SeethingSwarmVisibleContentBounds } from "#game/data/src/SeethingSwarmRuntimeClipCatalog"
import type { ZooAnimalId } from "#game/data/src/ZooAnimals"
import sharp from "sharp"

export type SeethingSwarmVisibleContentSelection = Readonly<{
  animalId: ZooAnimalId
  relativePath: string
  frameWidth: number
  frameHeight: number
  frameCount: number
}>

export type SeethingSwarmRawRgbaImage = Readonly<{
  data: Uint8Array
  width: number
  height: number
  channels: number
}>

export type SeethingSwarmVisibleContentAnalysis = Readonly<{
  frameBounds: readonly SeethingSwarmVisibleContentBounds[]
  unionVisibleBounds: SeethingSwarmVisibleContentBounds
  integerScale: number
  frameOffsetX: number
  frameOffsetY: number
}>

function assertPositiveSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

function assertRawRgbaImage(
  image: SeethingSwarmRawRgbaImage,
  selection: SeethingSwarmVisibleContentSelection,
) {
  assertPositiveSafeInteger(selection.frameWidth, "character frame width")
  assertPositiveSafeInteger(selection.frameHeight, "character frame height")
  assertPositiveSafeInteger(selection.frameCount, "character frame count")
  assertPositiveSafeInteger(image.width, "sprite-strip width")
  assertPositiveSafeInteger(image.height, "sprite-strip height")
  if (image.channels !== 4) {
    throw new Error(`Invalid sprite-strip channel count: ${image.channels}`)
  }

  const expectedWidth = selection.frameWidth * selection.frameCount
  assertPositiveSafeInteger(expectedWidth, "sprite-strip expected width")
  if (image.width !== expectedWidth || image.height !== selection.frameHeight) {
    throw new Error(
      `Invalid sprite-strip geometry for ${selection.animalId}: expected ${expectedWidth}x${selection.frameHeight}, received ${image.width}x${image.height}`,
    )
  }

  const expectedByteLength = image.width * image.height * image.channels
  if (image.data.byteLength !== expectedByteLength) {
    throw new Error(
      `Invalid sprite-strip byte length for ${selection.animalId}: expected ${expectedByteLength}, received ${image.data.byteLength}`,
    )
  }
}

function analyzeFrameBounds(
  image: SeethingSwarmRawRgbaImage,
  selection: SeethingSwarmVisibleContentSelection,
  frameIndex: number,
) {
  let minimumX = selection.frameWidth
  let minimumY = selection.frameHeight
  let maximumX = -1
  let maximumY = -1
  const frameStartX = frameIndex * selection.frameWidth

  for (let y = 0; y < selection.frameHeight; y += 1) {
    for (let x = 0; x < selection.frameWidth; x += 1) {
      const sourceX = frameStartX + x
      const alphaIndex = (y * image.width + sourceX) * image.channels + 3
      if (image.data[alphaIndex] === 0) continue

      minimumX = Math.min(minimumX, x)
      minimumY = Math.min(minimumY, y)
      maximumX = Math.max(maximumX, x)
      maximumY = Math.max(maximumY, y)
    }
  }

  if (maximumX < 0 || maximumY < 0) {
    throw new Error(
      `Transparent SeethingSwarm frame for ${selection.animalId}: ${frameIndex}`,
    )
  }

  return Object.freeze({
    left: minimumX,
    top: minimumY,
    width: maximumX - minimumX + 1,
    height: maximumY - minimumY + 1,
  }) satisfies SeethingSwarmVisibleContentBounds
}

function createUnionBounds(
  frameBounds: readonly SeethingSwarmVisibleContentBounds[],
) {
  const left = Math.min(...frameBounds.map((bounds) => bounds.left))
  const top = Math.min(...frameBounds.map((bounds) => bounds.top))
  const right = Math.max(
    ...frameBounds.map((bounds) => bounds.left + bounds.width),
  )
  const bottom = Math.max(
    ...frameBounds.map((bounds) => bounds.top + bounds.height),
  )

  return Object.freeze({
    left,
    top,
    width: right - left,
    height: bottom - top,
  }) satisfies SeethingSwarmVisibleContentBounds
}

export function analyzeSeethingSwarmVisibleContent(
  image: SeethingSwarmRawRgbaImage,
  selection: SeethingSwarmVisibleContentSelection,
) {
  assertRawRgbaImage(image, selection)
  const frameBounds = Object.freeze(
    Array.from({ length: selection.frameCount }, (_, frameIndex) =>
      analyzeFrameBounds(image, selection, frameIndex),
    ),
  )
  const unionVisibleBounds = createUnionBounds(frameBounds)
  const geometry = createSeethingSwarmAnimalPresentationGeometry(
    selection.frameWidth,
    selection.frameHeight,
    unionVisibleBounds,
  )

  return Object.freeze({
    frameBounds,
    unionVisibleBounds,
    integerScale: geometry.integerScale,
    frameOffsetX: geometry.frameOffsetX,
    frameOffsetY: geometry.frameOffsetY,
  }) satisfies SeethingSwarmVisibleContentAnalysis
}

export async function analyzeSeethingSwarmVisibleContentFile(
  absolutePath: string,
  selection: SeethingSwarmVisibleContentSelection,
) {
  const { data, info } = await sharp(absolutePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return analyzeSeethingSwarmVisibleContent(
    {
      data,
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
    selection,
  )
}
