import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import sharp from "sharp"
import { describe, expect, it } from "vitest"
import {
  analyzeSeethingSwarmVisibleContent,
  analyzeSeethingSwarmVisibleContentFile,
  type SeethingSwarmRawRgbaImage,
  type SeethingSwarmVisibleContentSelection,
} from "./SeethingSwarmVisibleContentAnalyzer"

function createSelection(
  overrides: Partial<SeethingSwarmVisibleContentSelection> = {},
) {
  return Object.freeze({
    animalId: "bat",
    relativePath: "bat_spritesheets/bat_idle_upright_strip5.png",
    frameWidth: 4,
    frameHeight: 4,
    frameCount: 5,
    ...overrides,
  }) satisfies SeethingSwarmVisibleContentSelection
}

function createTransparentImage(
  selection: SeethingSwarmVisibleContentSelection = createSelection(),
) {
  const width = selection.frameWidth * selection.frameCount
  const height = selection.frameHeight
  return {
    data: new Uint8Array(width * height * 4),
    width,
    height,
    channels: 4,
  } satisfies SeethingSwarmRawRgbaImage
}

function setOpaquePixel(
  image: SeethingSwarmRawRgbaImage,
  selection: SeethingSwarmVisibleContentSelection,
  frameIndex: number,
  x: number,
  y: number,
) {
  const sourceX = frameIndex * selection.frameWidth + x
  const pixelIndex = (y * image.width + sourceX) * image.channels
  image.data[pixelIndex] = 20
  image.data[pixelIndex + 1] = 40
  image.data[pixelIndex + 2] = 60
  image.data[pixelIndex + 3] = 255
}

function createPopulatedImage() {
  const selection = createSelection()
  const image = createTransparentImage(selection)

  setOpaquePixel(image, selection, 0, 1, 2)
  setOpaquePixel(image, selection, 0, 2, 3)
  setOpaquePixel(image, selection, 1, 1, 1)
  setOpaquePixel(image, selection, 2, 0, 0)
  setOpaquePixel(image, selection, 2, 3, 2)
  setOpaquePixel(image, selection, 3, 2, 1)
  setOpaquePixel(image, selection, 4, 3, 3)

  return Object.freeze({ selection, image })
}

function fillEveryFrame(
  image: SeethingSwarmRawRgbaImage,
  selection: SeethingSwarmVisibleContentSelection,
) {
  for (let frameIndex = 0; frameIndex < selection.frameCount; frameIndex += 1) {
    setOpaquePixel(image, selection, frameIndex, 0, 0)
  }
}

describe("SeethingSwarm visible-content analyzer", () => {
  it("measures every frame and derives the union bottom-center geometry", () => {
    const { selection, image } = createPopulatedImage()
    const analysis = analyzeSeethingSwarmVisibleContent(image, selection)

    expect(analysis.frameBounds).toEqual([
      { left: 1, top: 2, width: 2, height: 2 },
      { left: 1, top: 1, width: 1, height: 1 },
      { left: 0, top: 0, width: 4, height: 3 },
      { left: 2, top: 1, width: 1, height: 1 },
      { left: 3, top: 3, width: 1, height: 1 },
    ])
    expect(analysis.unionVisibleBounds).toEqual({
      left: 0,
      top: 0,
      width: 4,
      height: 4,
    })
    expect(analysis).toMatchObject({
      integerScale: 18,
      frameOffsetX: 0,
      frameOffsetY: 0,
    })
    expect(Object.isFrozen(analysis)).toBe(true)
    expect(Object.isFrozen(analysis.frameBounds)).toBe(true)
    expect(analysis.frameBounds.every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(analysis.unionVisibleBounds)).toBe(true)
  })

  it("decodes an authored PNG through Sharp before applying identical analysis", async () => {
    const { selection, image } = createPopulatedImage()
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "wayvm-visible-content-"),
    )
    const pngPath = join(temporaryDirectory, "strip.png")

    try {
      await sharp(Buffer.from(image.data), {
        raw: {
          width: image.width,
          height: image.height,
          channels: 4,
        },
      })
        .png()
        .toFile(pngPath)

      await expect(
        analyzeSeethingSwarmVisibleContentFile(pngPath, selection),
      ).resolves.toEqual(analyzeSeethingSwarmVisibleContent(image, selection))
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true })
    }
  })

  it.each([
    [{ frameWidth: 0 }, "Invalid character frame width"],
    [{ frameHeight: 0 }, "Invalid character frame height"],
    [{ frameCount: 0 }, "Invalid character frame count"],
    [
      { frameWidth: Number.MAX_SAFE_INTEGER, frameCount: 2 },
      "Invalid sprite-strip expected width",
    ],
  ] as const)(
    "rejects impossible selection geometry %#",
    (selectionOverrides, expectedMessage) => {
      expect(() =>
        analyzeSeethingSwarmVisibleContent(
          createTransparentImage(),
          createSelection(selectionOverrides),
        ),
      ).toThrow(expectedMessage)
    },
  )

  it.each([
    [{ width: 0 }, "Invalid sprite-strip width"],
    [{ height: 0 }, "Invalid sprite-strip height"],
    [{ channels: 3 }, "Invalid sprite-strip channel count"],
    [{ width: 19 }, "Invalid sprite-strip geometry"],
    [{ height: 3 }, "Invalid sprite-strip geometry"],
    [{ data: new Uint8Array(399) }, "Invalid sprite-strip byte length"],
  ] as const)(
    "rejects malformed raw image data %#",
    (imageOverrides, expectedMessage) => {
      const { selection, image } = createPopulatedImage()
      expect(() =>
        analyzeSeethingSwarmVisibleContent(
          { ...image, ...imageOverrides },
          selection,
        ),
      ).toThrow(expectedMessage)
    },
  )

  it("rejects any transparent frame instead of hiding malformed animation", () => {
    const selection = createSelection()
    const image = createTransparentImage(selection)
    setOpaquePixel(image, selection, 0, 0, 0)

    expect(() => analyzeSeethingSwarmVisibleContent(image, selection)).toThrow(
      "Transparent SeethingSwarm frame for bat: 1",
    )
  })

  it("rejects visible content that cannot fit the fixed presentation tile", () => {
    const selection = createSelection({
      frameWidth: 80,
      frameHeight: 80,
      frameCount: 1,
    })
    const image = createTransparentImage(selection)
    image.data.fill(255)

    expect(() => analyzeSeethingSwarmVisibleContent(image, selection)).toThrow(
      "cannot fit the 72-unit tile",
    )
  })

  it("accepts opaque content at every legal frame boundary", () => {
    const selection = createSelection()
    const image = createTransparentImage(selection)
    fillEveryFrame(image, selection)

    expect(analyzeSeethingSwarmVisibleContent(image, selection)).toMatchObject({
      unionVisibleBounds: { left: 0, top: 0, width: 1, height: 1 },
      integerScale: 72,
      frameOffsetX: 0,
      frameOffsetY: 0,
    })
  })
})
