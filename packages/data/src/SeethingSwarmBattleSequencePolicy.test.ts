import { describe, expect, it } from "vitest"
import { resolveSeethingSwarmBattleSequence } from "./SeethingSwarmBattleSequencePolicy"
import type { SeethingSwarmRuntimeCharacterClip } from "./SeethingSwarmRuntimeClipCatalog"

function createClips(...animationIds: string[]) {
  return animationIds.map((animationId) =>
    Object.freeze({
      kind: "character",
      animalId: "raccoonpack",
      animationId,
      relativePath: `${animationId}.png`,
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 4,
      visibleBounds: { left: 0, top: 0, width: 32, height: 32 },
      asset: animationId,
    } satisfies SeethingSwarmRuntimeCharacterClip<string>),
  )
}

describe("SeethingSwarm complete source sequences", () => {
  it.each([
    ["hide", ["hide", "unhide"]],
    ["unhide", ["hide", "unhide"]],
    ["fall", ["jump", "fall", "land"]],
    ["fly", ["takeoff", "fly", "land"]],
    ["attack_air", ["takeoff", "attack_air", "land"]],
    ["land_upright", ["fly_forward", "land_upright"]],
    ["liedown_idle", ["liedown_godown", "liedown_idle", "liedown_getup"]],
  ] as const)(
    "resolves %s only with all authored partners",
    (animationId, expected) => {
      const clips = createClips(...expected)
      const selected = clips.find((clip) => clip.animationId === animationId)!
      const sequence = resolveSeethingSwarmBattleSequence(
        selected,
        clips,
        false,
      )
      expect(sequence?.map((clip) => clip.animationId)).toEqual(expected)
      expect(Object.isFrozen(sequence)).toBe(true)
      expect(sequence?.every((clip) => clips.includes(clip))).toBe(true)
      const incomplete = clips.filter((clip) => clip !== clips.at(-1))
      expect(
        resolveSeethingSwarmBattleSequence(selected, incomplete, false),
      ).toBeNull()
    },
  )

  it("uses a complete supported alternative instead of an unavailable takeoff", () => {
    const clips = createClips("jump", "fly", "land")
    expect(
      resolveSeethingSwarmBattleSequence(clips[1], clips, false)?.map(
        (clip) => clip.animationId,
      ),
    ).toEqual(["jump", "fly", "land"])
  })

  it("settles a complete resting transition into idle rather than looping its exit", () => {
    const clips = createClips("hide", "unhide", "idle")
    expect(
      resolveSeethingSwarmBattleSequence(clips[0], clips, true)?.map(
        (clip) => clip.animationId,
      ),
    ).toEqual(["hide", "unhide", "idle"])
    expect(
      resolveSeethingSwarmBattleSequence(clips[0], clips.slice(0, 2), true),
    ).toBeNull()
  })

  it("preserves self-contained moves without manufacturing a compound", () => {
    const clips = createClips("dance")
    expect(resolveSeethingSwarmBattleSequence(clips[0], clips, false)).toEqual(
      clips,
    )
  })
})
