import { getPairCount } from "@game/data/src/ActiveDeck"
import type { BattleDelta } from "./BattleDelta"
import { encodeBattleDelta } from "./BattleDeltaCodec"

export const VALIDATED_TIMELINE_DELTA_LIMIT = 512 as const
export const TIMELINE_BYTE_BUDGET = 1_048_576 as const

export type BattleTimeline = {
  readonly history: readonly BattleDelta[]
  readonly redo: readonly BattleDelta[]
}

export type BattleTimelineLimits = {
  readonly deltaLimit: number
  readonly byteBudget: number
}

export const DEFAULT_BATTLE_TIMELINE_LIMITS = Object.freeze({
  deltaLimit: VALIDATED_TIMELINE_DELTA_LIMIT,
  byteBudget: TIMELINE_BYTE_BUDGET,
}) satisfies BattleTimelineLimits

function validateTimelineLimits(limits: BattleTimelineLimits) {
  const emptyTimelineByteLength = new TextEncoder().encode("[[],[]]").byteLength

  if (!Number.isSafeInteger(limits.deltaLimit) || limits.deltaLimit < 1) {
    throw new Error(`Invalid Battle Timeline delta limit: ${limits.deltaLimit}`)
  }

  if (
    !Number.isSafeInteger(limits.byteBudget) ||
    limits.byteBudget < emptyTimelineByteLength
  ) {
    throw new Error(`Invalid Battle Timeline byte budget: ${limits.byteBudget}`)
  }
}

function freezeBattleTimeline(
  history: readonly BattleDelta[],
  redo: readonly BattleDelta[],
) {
  return Object.freeze({
    history: Object.freeze([...history]),
    redo: Object.freeze([...redo]),
  }) satisfies BattleTimeline
}

export function createEmptyBattleTimeline() {
  return freezeBattleTimeline([], [])
}

export function getBattleTimelineCapacity(
  activeValueCount: number,
  limits: BattleTimelineLimits = DEFAULT_BATTLE_TIMELINE_LIMITS,
) {
  validateTimelineLimits(limits)
  return Math.min(getPairCount(activeValueCount), limits.deltaLimit)
}

export function getBattleTimelineSerializedByteLength(
  timeline: BattleTimeline,
) {
  const serializedTimeline = JSON.stringify([
    timeline.history.map(encodeBattleDelta),
    timeline.redo.map(encodeBattleDelta),
  ])

  return new TextEncoder().encode(serializedTimeline).byteLength
}

export function appendBattleTimelineDelta({
  timeline,
  delta,
  activeValueCount,
  limits = DEFAULT_BATTLE_TIMELINE_LIMITS,
}: {
  readonly timeline: BattleTimeline
  readonly delta: BattleDelta
  readonly activeValueCount: number
  readonly limits?: BattleTimelineLimits
}) {
  const capacity = getBattleTimelineCapacity(activeValueCount, limits)
  const history = [...timeline.history, delta]
  let candidate = freezeBattleTimeline(history, [])

  while (
    candidate.history.length > capacity ||
    getBattleTimelineSerializedByteLength(candidate) > limits.byteBudget
  ) {
    history.shift()
    candidate = freezeBattleTimeline(history, [])
  }

  return candidate
}

export function takeBattleTimelineUndo(timeline: BattleTimeline) {
  const delta = timeline.history.at(-1)
  if (!delta) {
    return null
  }

  return Object.freeze({
    delta,
    timeline: freezeBattleTimeline(timeline.history.slice(0, -1), [
      ...timeline.redo,
      delta,
    ]),
  })
}

export function takeBattleTimelineRedo(timeline: BattleTimeline) {
  const delta = timeline.redo.at(-1)
  if (!delta) {
    return null
  }

  return Object.freeze({
    delta,
    timeline: freezeBattleTimeline(
      [...timeline.history, delta],
      timeline.redo.slice(0, -1),
    ),
  })
}
