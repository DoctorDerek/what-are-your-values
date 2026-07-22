import type { ValueId } from "@game/data/src/Value"
import {
  createBattleCycleCandidate,
  createInitialBattleCycle,
  type BattleCycleState,
} from "./BattleCycle"
import type { BattleDelta } from "./BattleDelta"
import { redoBattleDelta, undoBattleDelta } from "./BattleDeltaTransition"
import {
  appendBattleTimelineDelta,
  createEmptyBattleTimeline,
  takeBattleTimelineRedo,
  takeBattleTimelineUndo,
  type BattleTimeline,
  type BattleTimelineLimits,
} from "./BattleTimeline"
import type { SchedulerRestorePoint } from "./PairScheduler"

export type BattleProfile = BattleCycleState & BattleTimeline

export type BattleProfileTransition = {
  readonly profile: BattleProfile
  readonly delta: BattleDelta
}

function createBattleProfile(
  battleCycle: BattleCycleState,
  timeline: BattleTimeline,
) {
  return Object.freeze({
    activeDeck: battleCycle.activeDeck,
    progressById: battleCycle.progressById,
    cycleLevelSnapshot: battleCycle.cycleLevelSnapshot,
    scheduler: battleCycle.scheduler,
    history: timeline.history,
    redo: timeline.redo,
  }) satisfies BattleProfile
}

function createBattleProfileTransition(
  battleCycle: BattleCycleState,
  timeline: BattleTimeline,
  delta: BattleDelta,
) {
  return Object.freeze({
    profile: createBattleProfile(battleCycle, timeline),
    delta,
  }) satisfies BattleProfileTransition
}

export function createInitialBattleProfile(seed: string) {
  return createBattleProfile(
    createInitialBattleCycle(seed),
    createEmptyBattleTimeline(),
  )
}

export function applyBattleChoice({
  profile,
  winnerId,
  expectedScheduler,
  timelineLimits,
}: {
  readonly profile: BattleProfile
  readonly winnerId: ValueId
  readonly expectedScheduler: SchedulerRestorePoint
  readonly timelineLimits?: BattleTimelineLimits
}) {
  const candidate = createBattleCycleCandidate({
    battleCycle: profile,
    winnerId,
    expectedScheduler,
  })
  const timeline = appendBattleTimelineDelta({
    timeline: profile,
    delta: candidate.delta,
    activeValueCount: candidate.activeDeck.valueIds.length,
    limits: timelineLimits,
  })

  return createBattleProfileTransition(candidate, timeline, candidate.delta)
}

export function applyBattleUndo(profile: BattleProfile) {
  const timelineTransition = takeBattleTimelineUndo(profile)
  if (!timelineTransition) {
    return null
  }

  return createBattleProfileTransition(
    undoBattleDelta({
      battleCycle: profile,
      delta: timelineTransition.delta,
    }),
    timelineTransition.timeline,
    timelineTransition.delta,
  )
}

export function applyBattleRedo(profile: BattleProfile) {
  const timelineTransition = takeBattleTimelineRedo(profile)
  if (!timelineTransition) {
    return null
  }

  return createBattleProfileTransition(
    redoBattleDelta({
      battleCycle: profile,
      delta: timelineTransition.delta,
    }),
    timelineTransition.timeline,
    timelineTransition.delta,
  )
}
