import type { ValueId } from "@game/data/src/Value"
import { type CustomValueDefinition } from "@game/data/src/Value"
import type { ActiveDeck } from "@game/data/src/ActiveDeck"
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
  validateBattleTimeline,
  type BattleTimeline,
  type BattleTimelineLimits,
} from "./BattleTimeline"
import type { SchedulerRestorePoint } from "./PairScheduler"
import { areSchedulerIdentitiesEqual } from "./SchedulerIdentity"
import { createDeckRevisionCandidate } from "./DeckRevision"

export type BattleProfile = BattleCycleState & BattleTimeline

export type BattleProfileTransition = {
  readonly profile: BattleProfile
  readonly delta: BattleDelta
}

export type BattleProfileDeckRevisionTransition = {
  readonly profile: BattleProfile
  readonly activeDeck: ActiveDeck
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

function assertBattleCycleStateEquals(
  actual: BattleCycleState,
  expected: BattleCycleState,
) {
  if (!areSchedulerIdentitiesEqual(actual.scheduler, expected.scheduler)) {
    throw new Error("Battle Profile scheduler does not match retained History")
  }

  expected.activeDeck.valueIds.forEach((valueId) => {
    const actualProgress = actual.progressById.get(valueId)
    const expectedProgress = expected.progressById.get(valueId)

    if (
      !actualProgress ||
      !expectedProgress ||
      actualProgress.totalXp !== expectedProgress.totalXp ||
      actualProgress.profileWins !== expectedProgress.profileWins ||
      actualProgress.profileComparisons !==
        expectedProgress.profileComparisons ||
      actualProgress.currentCycleWins !== expectedProgress.currentCycleWins
    ) {
      throw new Error(
        `Battle Profile progress does not match retained History for ${valueId}`,
      )
    }

    if (
      actual.cycleLevelSnapshot.get(valueId) !==
      expected.cycleLevelSnapshot.get(valueId)
    ) {
      throw new Error(
        `Battle Profile cycle snapshot does not match retained History for ${valueId}`,
      )
    }
  })
}

export function validateBattleProfile(
  profile: BattleProfile,
  timelineLimits?: BattleTimelineLimits,
) {
  const timeline = validateBattleTimeline({
    timeline: profile,
    activeValueCount: profile.activeDeck.valueIds.length,
    limits: timelineLimits,
  })
  let historyBase: BattleCycleState = profile

  for (let index = timeline.history.length - 1; index >= 0; index -= 1) {
    historyBase = undoBattleDelta({
      battleCycle: historyBase,
      delta: timeline.history[index],
    })
  }

  const replayedCurrentState = timeline.history.reduce(
    (battleCycle, delta) => redoBattleDelta({ battleCycle, delta }),
    historyBase,
  )
  assertBattleCycleStateEquals(replayedCurrentState, profile)

  for (
    let index = timeline.redo.length - 1, redoState: BattleCycleState = profile;
    index >= 0;
    index -= 1
  ) {
    redoState = redoBattleDelta({
      battleCycle: redoState,
      delta: timeline.redo[index],
    })
  }

  return createBattleProfile(profile, timeline)
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

export function applyDeckRevision({
  profile,
  revisedCustomValues,
}: {
  readonly profile: BattleProfile
  readonly revisedCustomValues: readonly CustomValueDefinition[]
}) {
  const candidate = createDeckRevisionCandidate({
    priorActiveDeck: profile.activeDeck,
    revisedCustomValues,
    progressById: profile.progressById,
    deckRevision: profile.scheduler.deckRevision,
    progressGeneration: profile.scheduler.progressGeneration,
    seed: profile.scheduler.seed,
  })
  return Object.freeze({
    profile: Object.freeze({
      activeDeck: candidate.activeDeck,
      progressById: candidate.progressById,
      cycleLevelSnapshot: candidate.cycleLevelSnapshot,
      scheduler: candidate.scheduler,
      history: [],
      redo: [],
    }) satisfies BattleProfile,
    activeDeck: candidate.activeDeck,
  }) satisfies BattleProfileDeckRevisionTransition
}
