import { describe, expect, it } from "vitest"
import {
  createSeethingSwarmAnimalManifest,
  type SeethingSwarmAnimalManifestInput,
  type SeethingSwarmAuxiliaryEffectInput,
  type SeethingSwarmCharacterAnimationInput,
} from "./SeethingSwarmAnimalManifest"

const idleAnimation = Object.freeze({
  animationId: "idle",
  relativePath: "frogpack_spritesheets/frog_idle_strip4.png",
  frameCount: 4,
}) satisfies SeethingSwarmCharacterAnimationInput

const hopAnimation = Object.freeze({
  animationId: "hop",
  relativePath: "frogpack_spritesheets/frog_hop_strip8.png",
  frameCount: 8,
}) satisfies SeethingSwarmCharacterAnimationInput

const flyEffect = Object.freeze({
  effectId: "fly",
  relativePath: "frogpack_spritesheets/fly_fly_strip2.png",
  frameWidth: 8,
  frameHeight: 6,
  frameCount: 2,
}) satisfies SeethingSwarmAuxiliaryEffectInput

const frogpackManifestInput = Object.freeze({
  animalId: "frogpack",
  familyId: "frogpack",
  sourceRelativePath: "frogpack_spritesheets",
  sourceColorLabel: "green",
  frameWidth: 50,
  frameHeight: 50,
  animations: Object.freeze([idleAnimation, hopAnimation]),
  auxiliaryEffects: Object.freeze([flyEffect]),
  evidenceSnapshotId: "seethingswarm-animals-2026-08-28",
}) satisfies SeethingSwarmAnimalManifestInput

function createFrogpackManifest(
  overrides: Partial<SeethingSwarmAnimalManifestInput> = {},
) {
  return createSeethingSwarmAnimalManifest({
    ...frogpackManifestInput,
    ...overrides,
  })
}

describe("SeethingSwarm animal manifest", () => {
  it("keeps Frogpack character geometry separate from its fly effect", () => {
    const manifest = createFrogpackManifest()

    expect(manifest.frameWidth).toBe(50)
    expect(manifest.frameHeight).toBe(50)
    expect(manifest.animations.idle).toEqual({
      relativePath: "frogpack_spritesheets/frog_idle_strip4.png",
      frameCount: 4,
    })
    expect(manifest.animations.fly).toBeUndefined()
    expect(manifest.auxiliaryEffects?.fly).toEqual({
      relativePath: "frogpack_spritesheets/fly_fly_strip2.png",
      frameWidth: 8,
      frameHeight: 6,
      frameCount: 2,
    })
  })

  it("deeply freezes the normalized manifest", () => {
    const manifest = createFrogpackManifest()
    const auxiliaryEffects = manifest.auxiliaryEffects!

    expect(Object.isFrozen(manifest)).toBe(true)
    expect(Object.isFrozen(manifest.animations)).toBe(true)
    expect(Object.values(manifest.animations).every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(auxiliaryEffects)).toBe(true)
    expect(Object.values(auxiliaryEffects).every(Object.isFrozen)).toBe(true)
  })

  it("omits the optional auxiliary-effect map when no effects exist", () => {
    const manifest = createFrogpackManifest({ auxiliaryEffects: undefined })

    expect(manifest).not.toHaveProperty("auxiliaryEffects")
  })

  it.each([
    ["animal family ID", { familyId: "Frogpack" }],
    ["source color label", { sourceColorLabel: " " }],
    ["evidence snapshot ID", { evidenceSnapshotId: "" }],
  ] satisfies readonly [string, Partial<SeethingSwarmAnimalManifestInput>][])(
    "rejects an invalid %s",
    (label, overrides) => {
      expect(() => createFrogpackManifest(overrides)).toThrow(
        `Invalid ${label}`,
      )
    },
  )

  it.each([
    ["empty", ""],
    ["backslash", "frogpack_spritesheets\\frog"],
    ["absolute", "/frogpack_spritesheets"],
    ["trailing slash", "frogpack_spritesheets/"],
    ["empty segment", "frogpack_spritesheets//frog"],
    ["current-directory segment", "frogpack_spritesheets/./frog"],
    ["parent-directory segment", "frogpack_spritesheets/../frog"],
  ])("rejects a %s animal source path", (_, sourceRelativePath) => {
    expect(() => createFrogpackManifest({ sourceRelativePath })).toThrow(
      "Invalid animal source path",
    )
  })

  it.each([
    ["zero character width", { frameWidth: 0 }],
    ["fractional character width", { frameWidth: 1.5 }],
    ["negative character height", { frameHeight: -1 }],
    ["unsafe character height", { frameHeight: Number.MAX_SAFE_INTEGER + 1 }],
  ] satisfies readonly [string, Partial<SeethingSwarmAnimalManifestInput>][])(
    "rejects %s",
    (_, overrides) => {
      expect(() => createFrogpackManifest(overrides)).toThrow(
        "Invalid character frame",
      )
    },
  )

  it.each([
    [
      "a non-normalized character ID",
      [{ ...idleAnimation, animationId: "idle-animation" }],
      "Invalid character animation ID",
    ],
    [
      "an exact duplicate character ID",
      [idleAnimation, idleAnimation],
      "Duplicate character animation ID",
    ],
    [
      "a case-only character ID collision",
      [idleAnimation, { ...hopAnimation, animationId: "Idle" }],
      "Duplicate character animation ID",
    ],
    [
      "a traversal character path",
      [{ ...idleAnimation, relativePath: "../frog_idle_strip4.png" }],
      "Invalid character animation path",
    ],
    [
      "a non-PNG character path",
      [{ ...idleAnimation, relativePath: "frog_idle_strip4.jpg" }],
      "Invalid character animation path",
    ],
    [
      "a zero character frame count",
      [{ ...idleAnimation, frameCount: 0 }],
      "Invalid character animation frame count",
    ],
    [
      "a fractional character frame count",
      [{ ...idleAnimation, frameCount: 1.5 }],
      "Invalid character animation frame count",
    ],
  ] satisfies readonly [
    string,
    readonly SeethingSwarmCharacterAnimationInput[],
    string,
  ][])("rejects %s", (_, animations, message) => {
    expect(() => createFrogpackManifest({ animations })).toThrow(message)
  })

  it.each([
    [
      "a non-normalized effect ID",
      [{ ...flyEffect, effectId: "fly-effect" }],
      "Invalid auxiliary effect ID",
    ],
    [
      "an exact duplicate effect ID",
      [flyEffect, flyEffect],
      "Duplicate auxiliary effect ID",
    ],
    [
      "a case-only effect ID collision",
      [flyEffect, { ...flyEffect, effectId: "Fly" }],
      "Duplicate auxiliary effect ID",
    ],
    [
      "an absolute effect path",
      [{ ...flyEffect, relativePath: "/fly_fly_strip2.png" }],
      "Invalid auxiliary effect path",
    ],
    [
      "a non-PNG effect path",
      [{ ...flyEffect, relativePath: "fly_fly_strip2.gif" }],
      "Invalid auxiliary effect path",
    ],
    [
      "a zero effect width",
      [{ ...flyEffect, frameWidth: 0 }],
      "Invalid auxiliary effect frame width",
    ],
    [
      "a fractional effect height",
      [{ ...flyEffect, frameHeight: 1.5 }],
      "Invalid auxiliary effect frame height",
    ],
    [
      "an unsafe effect frame count",
      [{ ...flyEffect, frameCount: Number.MAX_SAFE_INTEGER + 1 }],
      "Invalid auxiliary effect frame count",
    ],
  ] satisfies readonly [
    string,
    readonly SeethingSwarmAuxiliaryEffectInput[],
    string,
  ][])("rejects %s", (_, auxiliaryEffects, message) => {
    expect(() => createFrogpackManifest({ auxiliaryEffects })).toThrow(message)
  })

  it("rejects exact and case-only asset path collisions", () => {
    expect(() =>
      createFrogpackManifest({
        animations: [
          idleAnimation,
          { ...hopAnimation, relativePath: idleAnimation.relativePath },
        ],
      }),
    ).toThrow("Duplicate asset path")

    expect(() =>
      createFrogpackManifest({
        auxiliaryEffects: [
          {
            ...flyEffect,
            relativePath: idleAnimation.relativePath
              .toUpperCase()
              .replace(".PNG", ".png"),
          },
        ],
      }),
    ).toThrow("Duplicate asset path")
  })
})
