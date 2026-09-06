import { createActiveDeck } from "@game/data/src/ActiveDeck"
import { createSeethingSwarmAnimalPresentationGeometry } from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { SeethingSwarmLicensedRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import { createCanonicalValueId } from "@game/data/src/Value"
import { describe, expect, it } from "vitest"
import { createSchedulerRestorePoint } from "./PairScheduler"
import { createSeethingSwarmBattleChoreography } from "./SeethingSwarmBattleChoreography"
import { createSeethingSwarmBattlePlayback } from "./SeethingSwarmBattlePlayback"

const pair = [
  createCanonicalValueId("pvcs-2011:mastery"),
  createCanonicalValueId("pvcs-2011:courage"),
] as const
const animals = (["raccoonpack", "wolfpack"] as const).map((animalId) => ({
  animalId,
  characterClips: ["run", "idle", "crouch", "attack", "hurt", "dance"].map(
    (animationId) => ({
      kind: "character" as const,
      animalId,
      animationId,
      relativePath: `${animalId}/${animationId}.png`,
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 4,
      visibleBounds: { left: 0, top: 0, width: 32, height: 32 },
      asset: animationId,
    }),
  ),
  auxiliaryEffectClips: [],
}))
const catalog = {
  mode: "licensed",
  evidenceSnapshotId: "playback-test",
  animals,
  characterClipCount: 12,
  auxiliaryEffectClipCount: 0,
} satisfies SeethingSwarmLicensedRuntimeClipCatalog<string>
const battle = {
  pair,
  scheduler: createSchedulerRestorePoint({
    activeDeck: createActiveDeck([]),
    progressGeneration: 0,
    deckRevision: 0,
    seed: "playback-test",
    cycleIndex: 0,
    cursor: 0,
  }),
}
const choreography = createSeethingSwarmBattleChoreography({ battle, catalog })
if (choreography.mode !== "licensed")
  throw new Error("Expected licensed test choreography")
const combatant = choreography.combatants[0]

describe("SeethingSwarm battle playback", () => {
  it("plays every introductory role before resting without mutating its source", () => {
    const steps = createSeethingSwarmBattlePlayback({
      combatant,
      winnerId: null,
    })
    expect(steps.map(({ role, playbackMode }) => [role, playbackMode])).toEqual(
      [
        ["entry", "one-shot"],
        ["anticipation", "one-shot"],
        ["rest", "loop"],
      ],
    )
    expect(steps[0].clip).toBe(combatant.clips.entry.clip)
    expect(Object.isFrozen(steps)).toBe(true)
    expect(steps.every(Object.isFrozen)).toBe(true)
  })

  it.each([
    { winnerId: pair[0], expected: ["attack", "flourish"] },
    { winnerId: pair[1], expected: ["reaction"] },
  ])(
    "fits the $expected result sequence inside one shared presentation budget",
    ({ winnerId, expected }) => {
      const steps = createSeethingSwarmBattlePlayback({ combatant, winnerId })
      expect(steps.map(({ role }) => role)).toEqual(expected)
      expect(
        steps.every(({ playbackMode }) => playbackMode === "one-shot"),
      ).toBe(true)
      expect(
        steps.reduce(
          (duration, { clip, frameDurationMs }) =>
            duration + clip.frameCount * frameDurationMs,
          0,
        ),
      ).toBe(480)
    },
  )

  it("caps integer geometry consistently and rejects an invalid scale", () => {
    const bounds = { left: 1, top: 1, width: 2, height: 2 }
    expect(
      createSeethingSwarmAnimalPresentationGeometry(4, 4, bounds, 112, 20),
    ).toMatchObject({ integerScale: 20, frameOffsetX: 16, frameOffsetY: 52 })
    expect(() =>
      createSeethingSwarmAnimalPresentationGeometry(4, 4, bounds, 112, 0),
    ).toThrow("maximum scale")
  })
})
