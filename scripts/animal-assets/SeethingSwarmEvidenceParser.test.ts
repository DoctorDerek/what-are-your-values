import { describe, expect, it } from "vitest"
import {
  parseSeethingSwarmAnimationEvidence,
  parseSeethingSwarmGeometryEvidence,
  parseSeethingSwarmPaletteEvidence,
} from "./SeethingSwarmEvidenceParser"

const animationEvidence = [
  "bat_spritesheets/bat_idle_strip4.png -> idle -> 4 frames",
  "frogpack_spritesheets/frog_jump_strip8.png -> jump -> 8 frames",
].join("\n")

const paletteEvidence = [
  "bat_spritesheets -> dark_gray",
  "catset_spritesheets/cat01_brown_spritesheets -> brown",
].join("\n")

const geometryEvidence = [
  "bat_spritesheets -> 32x32",
  "frogpack_spritesheets -> 50x50",
].join("\n")

describe("SeethingSwarm evidence parser", () => {
  it("parses animation palette and geometry evidence into frozen records", () => {
    const animations = parseSeethingSwarmAnimationEvidence(animationEvidence)
    const palettes = parseSeethingSwarmPaletteEvidence(paletteEvidence)
    const geometries = parseSeethingSwarmGeometryEvidence(geometryEvidence)

    expect(animations).toEqual([
      {
        relativePath: "bat_spritesheets/bat_idle_strip4.png",
        animationId: "idle",
        frameCount: 4,
      },
      {
        relativePath: "frogpack_spritesheets/frog_jump_strip8.png",
        animationId: "jump",
        frameCount: 8,
      },
    ])
    expect(palettes).toEqual([
      { sourceRelativePath: "bat_spritesheets", colorLabel: "dark_gray" },
      {
        sourceRelativePath: "catset_spritesheets/cat01_brown_spritesheets",
        colorLabel: "brown",
      },
    ])
    expect(geometries).toEqual([
      {
        sourceRelativePath: "bat_spritesheets",
        frameWidth: 32,
        frameHeight: 32,
      },
      {
        sourceRelativePath: "frogpack_spritesheets",
        frameWidth: 50,
        frameHeight: 50,
      },
    ])

    for (const records of [animations, palettes, geometries]) {
      expect(Object.isFrozen(records)).toBe(true)
      expect(records.every(Object.isFrozen)).toBe(true)
    }
  })

  it("normalizes LF and CRLF evidence without changing records", () => {
    expect(
      parseSeethingSwarmAnimationEvidence(
        `${animationEvidence.replaceAll("\n", "\r\n")}\r\n`,
      ),
    ).toEqual(parseSeethingSwarmAnimationEvidence(`${animationEvidence}\n`))
    expect(
      parseSeethingSwarmPaletteEvidence(
        `${paletteEvidence.replaceAll("\n", "\r\n")}\r\n`,
      ),
    ).toEqual(parseSeethingSwarmPaletteEvidence(`${paletteEvidence}\n`))
    expect(
      parseSeethingSwarmGeometryEvidence(
        `${geometryEvidence.replaceAll("\n", "\r\n")}\r\n`,
      ),
    ).toEqual(parseSeethingSwarmGeometryEvidence(`${geometryEvidence}\n`))
  })

  it.each([
    ["empty input", ""],
    ["an internal empty line", `${animationEvidence}\n\n${animationEvidence}`],
    ["two terminal newlines", `${animationEvidence}\n\n`],
    ["a bare carriage return", animationEvidence.replace("\n", "\r")],
    ["a malformed separator", "bat_spritesheets/bat.png => idle => 4 frames"],
    [
      "an extra field",
      "bat_spritesheets/bat.png -> idle -> 4 frames -> unexpected",
    ],
    ["an absolute path", "/bat_spritesheets/bat.png -> idle -> 4 frames"],
    ["a traversal path", "../bat_spritesheets/bat.png -> idle -> 4 frames"],
    ["a backslash path", "bat_spritesheets\\bat.png -> idle -> 4 frames"],
    ["a non-PNG path", "bat_spritesheets/bat.gif -> idle -> 4 frames"],
    [
      "a non-normalized animation ID",
      "bat_spritesheets/bat.png -> idle-animation -> 4 frames",
    ],
    ["a zero frame count", "bat_spritesheets/bat.png -> idle -> 0 frames"],
    [
      "a fractional frame count",
      "bat_spritesheets/bat.png -> idle -> 1.5 frames",
    ],
    ["a singular frame suffix", "bat_spritesheets/bat.png -> idle -> 1 frame"],
    [
      "an unsafe frame count",
      `bat_spritesheets/bat.png -> idle -> ${Number.MAX_SAFE_INTEGER + 1} frames`,
    ],
  ])("rejects animation evidence containing %s", (_, evidence) => {
    expect(() => parseSeethingSwarmAnimationEvidence(evidence)).toThrow()
  })

  it("rejects exact and case-only animation path collisions", () => {
    expect(() =>
      parseSeethingSwarmAnimationEvidence(
        [
          "bat_spritesheets/bat.png -> idle -> 4 frames",
          "bat_spritesheets/bat.png -> run -> 8 frames",
        ].join("\n"),
      ),
    ).toThrow("Duplicate animation evidence path")
    expect(() =>
      parseSeethingSwarmAnimationEvidence(
        [
          "bat_spritesheets/bat.png -> idle -> 4 frames",
          "BAT_spritesheets/BAT.png -> run -> 8 frames",
        ].join("\n"),
      ),
    ).toThrow("Duplicate animation evidence path")
  })

  it.each([
    ["an empty line", `${paletteEvidence}\n\n${paletteEvidence}`],
    ["a malformed separator", "bat_spritesheets: dark_gray"],
    ["a traversal path", "../bat_spritesheets -> dark_gray"],
    ["an invalid color", "bat_spritesheets -> Dark Gray"],
  ])("rejects palette evidence containing %s", (_, evidence) => {
    expect(() => parseSeethingSwarmPaletteEvidence(evidence)).toThrow()
  })

  it("rejects duplicate and conflicting palette source records", () => {
    expect(() =>
      parseSeethingSwarmPaletteEvidence(
        [
          "bat_spritesheets -> dark_gray",
          "BAT_spritesheets -> light_gray",
        ].join("\n"),
      ),
    ).toThrow("Duplicate palette evidence source path")
  })

  it.each([
    ["an empty line", `${geometryEvidence}\n\n${geometryEvidence}`],
    ["a malformed separator", "bat_spritesheets: 32x32"],
    ["an absolute path", "/bat_spritesheets -> 32x32"],
    ["a zero width", "bat_spritesheets -> 0x32"],
    ["a fractional height", "bat_spritesheets -> 32x1.5"],
    ["a malformed dimension", "bat_spritesheets -> 32 X 32"],
    [
      "an unsafe width",
      `bat_spritesheets -> ${Number.MAX_SAFE_INTEGER + 1}x32`,
    ],
  ])("rejects geometry evidence containing %s", (_, evidence) => {
    expect(() => parseSeethingSwarmGeometryEvidence(evidence)).toThrow()
  })

  it("rejects duplicate and conflicting geometry source records", () => {
    expect(() =>
      parseSeethingSwarmGeometryEvidence(
        ["bat_spritesheets -> 32x32", "BAT_spritesheets -> 64x64"].join("\n"),
      ),
    ).toThrow("Duplicate geometry evidence source path")
  })
})
