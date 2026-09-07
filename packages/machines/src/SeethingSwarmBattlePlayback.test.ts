import { createActiveDeck } from "@game/data/src/ActiveDeck"
import { createSeethingSwarmAnimalPresentationGeometry } from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { SeethingSwarmLicensedRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import { createCanonicalValueId } from "@game/data/src/Value"
import { describe, expect, it } from "vitest"
import { createSchedulerRestorePoint } from "./PairScheduler"
import { createSeethingSwarmBattleChoreography } from "./SeethingSwarmBattleChoreography"
import { createSeethingSwarmBattlePlayback, getSeethingSwarmBattleClips } from "./SeethingSwarmBattlePlayback"

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
  it("acknowledges attention with anticipation and expression without blocking a choice", () => {
    const steps = createSeethingSwarmBattlePlayback({
      combatant,
      winnerId: null,
      cue: "attention",
    })
    expect(steps.map(({ role, playbackMode }) => [role, playbackMode])).toEqual(
      [
        ["anticipation", "one-shot"],
        ["flourish", "one-shot"],
        ["rest", "loop"],
      ],
    )
    expect(steps[0].clip).toBe(combatant.clips.anticipation.clip)
    expect(steps.every((step) => !step.blocksResult)).toBe(true)
  })
  it("plays every introductory role before resting without mutating its source", () => {
    const steps = createSeethingSwarmBattlePlayback({
      combatant,
      winnerId: null,
      cue: "introduction",
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
    { cue: "approach", winnerId: pair[0], expected: ["rest"] },
    { cue: "approach", winnerId: pair[1], expected: ["rest"] },
    { cue: "strike", winnerId: pair[0], expected: ["attack"] },
    { cue: "strike", winnerId: pair[1], expected: ["rest"] },
    { cue: "impact", winnerId: pair[0], expected: ["flourish"] },
    { cue: "impact", winnerId: pair[1], expected: ["reaction"] },
  ] as const)(
    "plays $expected for $cue without reacting before the strike",
    ({ cue, winnerId, expected }) => {
      const steps = createSeethingSwarmBattlePlayback({
        combatant,
        winnerId,
        cue,
      })
      expect(steps.map(({ role }) => role)).toEqual(expected)
      expect(steps.map(({ playbackMode }) => playbackMode)).toEqual([
        expected[0] === "rest" ? "loop" : "one-shot",
      ])
    },
  )

  it("preserves readable battle frames without charging optional expression to the result", () => {
    const winnerSteps = (["strike", "impact"] as const).flatMap((cue) =>
      createSeethingSwarmBattlePlayback({ combatant, winnerId: pair[0], cue }),
    )
    const loserSteps = createSeethingSwarmBattlePlayback({
      combatant,
      winnerId: pair[1],
      cue: "impact",
    })
    for (const steps of [winnerSteps, loserSteps]) {
      const required = steps.filter((step) => step.blocksResult)
      expect(required).toHaveLength(1)
      expect(required[0].frameDurationMs).toBe(60)
      expect(required[0].clip.frameCount * required[0].frameDurationMs).toBe(240)
    }
    expect(winnerSteps.at(-1)).toMatchObject({ role: "flourish", blocksResult: false, frameDurationMs: 160 })
  })

  it("plays complete aerial preparation before contact and requires landing after impact", () => {
    const source = combatant.clips.attack.clip
    const takeoff = { ...source, animationId: "takeoff", frameCount: 8 }
    const attack = { ...source, animationId: "attack_air", frameCount: 12 }
    const land = { ...source, animationId: "land", frameCount: 6 }
    const airborne = { ...combatant, clips: { ...combatant.clips, attack: {
      ...combatant.clips.attack, clip: attack, sequence: [takeoff, attack, land],
    } } }
    const strike = createSeethingSwarmBattlePlayback({ combatant: airborne, winnerId: pair[0], cue: "strike" })
    const impact = createSeethingSwarmBattlePlayback({ combatant: airborne, winnerId: pair[0], cue: "impact" })
    expect(strike.map((step) => step.clip.animationId)).toEqual(["takeoff", "attack_air"])
    expect(impact.map((step) => step.clip.animationId)).toEqual(["land", "dance"])
    expect([...strike, impact[0]].every((step) => step.blocksResult && step.frameDurationMs === 60)).toBe(true)
    expect(impact[1].blocksResult).toBe(false)
    const resources = getSeethingSwarmBattleClips(airborne)
    expect(resources.map((clip) => clip.animationId)).toEqual(expect.arrayContaining(["takeoff", "attack_air", "land"]))
    expect(new Set(resources.map((clip) => clip.animationId)).size).toBe(resources.length)
    expect(Object.isFrozen(resources)).toBe(true)
  })

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
