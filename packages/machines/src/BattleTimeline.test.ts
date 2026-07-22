import { describe, expect, it } from "vitest"
import {
  createBattleCycleCandidate,
  createInitialBattleCycle,
  type BattleCycleState,
} from "./BattleCycle"
import { encodeBattleDelta } from "./BattleDeltaCodec"
import {
  appendBattleTimelineDelta,
  createEmptyBattleTimeline,
  getBattleTimelineCapacity,
  getBattleTimelineSerializedByteLength,
  takeBattleTimelineRedo,
  takeBattleTimelineUndo,
  type BattleTimeline,
  type BattleTimelineLimits,
} from "./BattleTimeline"
import { projectScheduledPair } from "./PairScheduler"

const generousByteBudget = Number.MAX_SAFE_INTEGER

function commitFirstValue(battleCycle: BattleCycleState) {
  const [winnerId] = projectScheduledPair(
    battleCycle.activeDeck,
    battleCycle.scheduler,
  ).pair

  return createBattleCycleCandidate({
    battleCycle,
    winnerId,
    expectedScheduler: battleCycle.scheduler,
  })
}

function appendCandidate(
  timeline: BattleTimeline,
  battleCycle: BattleCycleState,
  limits?: BattleTimelineLimits,
) {
  const candidate = commitFirstValue(battleCycle)

  return {
    battleCycle: candidate,
    timeline: appendBattleTimelineDelta({
      timeline,
      delta: candidate.delta,
      activeValueCount: candidate.activeDeck.valueIds.length,
      limits,
    }),
  }
}

describe("Battle Timeline", () => {
  it("derives capacity from pair count and the validated event limit", () => {
    expect(
      getBattleTimelineCapacity(2, {
        deltaLimit: 512,
        byteBudget: generousByteBudget,
      }),
    ).toBe(1)
    expect(
      getBattleTimelineCapacity(100, {
        deltaLimit: 512,
        byteBudget: generousByteBudget,
      }),
    ).toBe(512)
  })

  it("moves retained deltas between History and Redo without duplication", () => {
    const first = appendCandidate(
      createEmptyBattleTimeline(),
      createInitialBattleCycle("timeline-movement-seed"),
    )
    const second = appendCandidate(first.timeline, first.battleCycle)

    expect(getBattleTimelineSerializedByteLength(second.timeline)).toBe(
      new TextEncoder().encode(
        JSON.stringify([
          second.timeline.history.map(encodeBattleDelta),
          second.timeline.redo.map(encodeBattleDelta),
        ]),
      ).byteLength,
    )

    const firstUndo = takeBattleTimelineUndo(second.timeline)
    if (!firstUndo) {
      throw new Error("The first retained battle cannot be undone")
    }

    expect(firstUndo.delta).toBe(second.timeline.history[1])
    expect(firstUndo.timeline.history).toEqual([second.timeline.history[0]])
    expect(firstUndo.timeline.redo).toEqual([second.timeline.history[1]])

    const secondUndo = takeBattleTimelineUndo(firstUndo.timeline)
    if (!secondUndo) {
      throw new Error("The second retained battle cannot be undone")
    }

    expect(secondUndo.timeline.history).toEqual([])
    expect(secondUndo.timeline.redo).toEqual([
      second.timeline.history[1],
      second.timeline.history[0],
    ])

    const firstRedo = takeBattleTimelineRedo(secondUndo.timeline)
    if (!firstRedo) {
      throw new Error("The most recently undone battle cannot be redone")
    }

    expect(firstRedo.delta).toBe(second.timeline.history[0])
    expect(firstRedo.timeline.history).toEqual([second.timeline.history[0]])
    expect(firstRedo.timeline.redo).toEqual([second.timeline.history[1]])
  })

  it("clears Redo when a new battle creates a branch", () => {
    const committed = appendCandidate(
      createEmptyBattleTimeline(),
      createInitialBattleCycle("timeline-branch-seed"),
    )
    const undone = takeBattleTimelineUndo(committed.timeline)

    if (!undone) {
      throw new Error("The retained battle cannot be undone")
    }

    const branched = appendCandidate(
      undone.timeline,
      createInitialBattleCycle("timeline-branch-seed"),
    )

    expect(branched.timeline.history).toHaveLength(1)
    expect(branched.timeline.redo).toHaveLength(0)
  })

  it("evicts the oldest applied delta to satisfy the combined event cap", () => {
    const limits = {
      deltaLimit: 2,
      byteBudget: generousByteBudget,
    } satisfies BattleTimelineLimits
    const first = appendCandidate(
      createEmptyBattleTimeline(),
      createInitialBattleCycle("timeline-cap-seed"),
      limits,
    )
    const second = appendCandidate(first.timeline, first.battleCycle, limits)
    const third = appendCandidate(second.timeline, second.battleCycle, limits)

    expect(third.timeline.history).toEqual([
      second.timeline.history[1],
      third.battleCycle.delta,
    ])
  })

  it("evicts applied deltas until the serialized byte budget passes", () => {
    const initialBattleCycle = createInitialBattleCycle("timeline-byte-seed")
    const candidate = commitFirstValue(initialBattleCycle)
    const oneDeltaTimeline = appendBattleTimelineDelta({
      timeline: createEmptyBattleTimeline(),
      delta: candidate.delta,
      activeValueCount: candidate.activeDeck.valueIds.length,
      limits: {
        deltaLimit: 512,
        byteBudget: generousByteBudget,
      },
    })
    const oneDeltaBytes =
      getBattleTimelineSerializedByteLength(oneDeltaTimeline)

    expect(
      appendBattleTimelineDelta({
        timeline: createEmptyBattleTimeline(),
        delta: candidate.delta,
        activeValueCount: candidate.activeDeck.valueIds.length,
        limits: { deltaLimit: 512, byteBudget: oneDeltaBytes - 1 },
      }).history,
    ).toEqual([])
  })

  it("reports unavailable Undo and Redo without mutating the empty timeline", () => {
    const timeline = createEmptyBattleTimeline()

    expect(takeBattleTimelineUndo(timeline)).toBeNull()
    expect(takeBattleTimelineRedo(timeline)).toBeNull()
    expect(timeline).toEqual({ history: [], redo: [] })
  })

  it("rejects a byte budget that cannot represent an empty timeline", () => {
    expect(() =>
      getBattleTimelineCapacity(100, { deltaLimit: 512, byteBudget: 6 }),
    ).toThrow("Invalid Battle Timeline byte budget: 6")
  })
})
