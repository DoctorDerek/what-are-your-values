import {
  getPairCount,
  type ActiveDeck,
} from "@game/data/src/ActiveDeck"
import type { ValueId, ValuePair } from "@game/data/src/Value"
import { shuffleDeterministically } from "./DeterministicSequence"
import {
  createPairOrientationContext,
  type PairOrientationContext,
} from "./PairOrientation"
import { deriveRoundRobinPairs } from "./RoundRobinPairs"

import {
  assertSchedulerIdentity,
  FULL_CYCLE_SCHEDULE_KIND,
  PAIR_SCHEDULER_ALGORITHM_VERSION,
  type SchedulerCursor,
  type SchedulerIdentity,
} from "./SchedulerIdentity"

export type SchedulerRestorePoint = SchedulerIdentity<
  typeof FULL_CYCLE_SCHEDULE_KIND
>

export type ScheduleShape = {
  readonly roundCount: number
  readonly matchesPerRound: number
  readonly pairCount: number
}

export type ScheduledRound = {
  readonly presentationRoundIndex: number
  readonly sourceRoundIndex: number
  readonly pairs: readonly ValuePair[]
}

export type ScheduledPairProjection = {
  readonly cursor: SchedulerCursor
  readonly presentationRoundIndex: number
  readonly sourceRoundIndex: number
  readonly matchIndex: number
  readonly pair: ValuePair
}

type CycleProjectionContext = {
  readonly cycleIdentity: string
  readonly orientation: PairOrientationContext
  readonly participantOrder: readonly ValueId[]
  readonly roundOrder: readonly number[]
  readonly shape: ScheduleShape
}

function createCycleIdentity(restorePoint: SchedulerRestorePoint) {
  return JSON.stringify([
    restorePoint.algorithmVersion,
    restorePoint.activeDeckFingerprint,
    restorePoint.progressGeneration,
    restorePoint.deckRevision,
    restorePoint.scheduleKind,
    restorePoint.seed,
    restorePoint.cycleIndex,
  ])
}

function createCycleProjectionContext(
  activeDeck: ActiveDeck,
  restorePoint: SchedulerRestorePoint,
): CycleProjectionContext {
  const shape = getScheduleShape(activeDeck.valueIds.length)
  const cycleIdentity = createCycleIdentity(restorePoint)
  const participantOrder = Object.freeze(
    shuffleDeterministically(
      activeDeck.valueIds,
      `${cycleIdentity}:participants`,
    ),
  )
  const roundOrder = Object.freeze(
    shuffleDeterministically(
      Array.from({ length: shape.roundCount }, (_, index) => index),
      `${cycleIdentity}:rounds`,
    ),
  )

  return {
    cycleIdentity,
    orientation: createPairOrientationContext(activeDeck.valueIds),
    participantOrder,
    roundOrder,
    shape,
  }
}

function deriveBaseRoundPairs(
  context: CycleProjectionContext,
  sourceRoundIndex: number,
  cycleIndex: number,
) {
  return deriveRoundRobinPairs({
    participantOrder: context.participantOrder,
    sourceRoundIndex,
    orientation: context.orientation,
    cycleIndex,
    matchOrderSeed: `${context.cycleIdentity}:matches:${sourceRoundIndex}`,
  })
}

function pairsShareValue(first: ValuePair, second: ValuePair) {
  return (
    first[0] === second[0] ||
    first[0] === second[1] ||
    first[1] === second[0] ||
    first[1] === second[1]
  )
}

function avoidImmediateBoundaryRepeat(
  pairs: readonly ValuePair[],
  previousRoundLastPair: ValuePair,
) {
  if (!pairsShareValue(pairs[0], previousRoundLastPair)) {
    return pairs
  }

  const replacementIndex = pairs.findIndex(
    (pair, index) =>
      index > 0 &&
      index < pairs.length - 1 &&
      !pairsShareValue(pair, previousRoundLastPair),
  )

  if (replacementIndex === -1) {
    throw new Error(
      "Active Deck cannot avoid an immediate round-boundary repeat",
    )
  }

  const reorderedPairs = [...pairs]
  const firstPair = reorderedPairs[0]
  reorderedPairs[0] = reorderedPairs[replacementIndex]
  reorderedPairs[replacementIndex] = firstPair
  return reorderedPairs
}

function assertSchedulerRestorePoint(
  activeDeck: ActiveDeck,
  restorePoint: SchedulerRestorePoint,
) {
  assertSchedulerIdentity({
    activeDeck,
    identity: restorePoint,
    expectedScheduleKind: FULL_CYCLE_SCHEDULE_KIND,
    pairCount: getPairCount(activeDeck.valueIds.length),
  })
}

export function getScheduleShape(activeValueCount: number): ScheduleShape {
  const pairCount = getPairCount(activeValueCount)
  const roundCount =
    activeValueCount % 2 === 0 ? activeValueCount - 1 : activeValueCount
  const matchesPerRound = Math.floor(activeValueCount / 2)

  return Object.freeze({ roundCount, matchesPerRound, pairCount })
}

export function createSchedulerRestorePoint({
  activeDeck,
  progressGeneration,
  deckRevision,
  seed,
  cycleIndex,
  cursor = 0,
}: {
  readonly activeDeck: ActiveDeck
  readonly progressGeneration: number
  readonly deckRevision: number
  readonly seed: string
  readonly cycleIndex: number
  readonly cursor?: number
}) {
  const restorePoint = Object.freeze({
    algorithmVersion: PAIR_SCHEDULER_ALGORITHM_VERSION,
    activeDeckFingerprint: activeDeck.fingerprint,
    progressGeneration,
    deckRevision,
    scheduleKind: FULL_CYCLE_SCHEDULE_KIND,
    seed,
    cycleIndex,
    cursor: cursor as SchedulerCursor,
  })

  assertSchedulerRestorePoint(activeDeck, restorePoint)
  return restorePoint
}

export function projectScheduledRound(
  activeDeck: ActiveDeck,
  restorePoint: SchedulerRestorePoint,
): ScheduledRound {
  assertSchedulerRestorePoint(activeDeck, restorePoint)

  const context = createCycleProjectionContext(activeDeck, restorePoint)
  const presentationRoundIndex = Math.floor(
    restorePoint.cursor / context.shape.matchesPerRound,
  )
  const sourceRoundIndex = context.roundOrder[presentationRoundIndex]
  let pairs: readonly ValuePair[] = deriveBaseRoundPairs(
    context,
    sourceRoundIndex,
    restorePoint.cycleIndex,
  )

  if (presentationRoundIndex > 0) {
    const previousSourceRoundIndex =
      context.roundOrder[presentationRoundIndex - 1]
    const previousRoundPairs = deriveBaseRoundPairs(
      context,
      previousSourceRoundIndex,
      restorePoint.cycleIndex,
    )
    const previousRoundLastPair = previousRoundPairs.at(-1)

    if (!previousRoundLastPair) {
      throw new Error("Scheduled round does not contain a previous pair")
    }

    pairs = avoidImmediateBoundaryRepeat(pairs, previousRoundLastPair)
  }

  return Object.freeze({
    presentationRoundIndex,
    sourceRoundIndex,
    pairs: Object.freeze(pairs),
  })
}

export function projectScheduledPair(
  activeDeck: ActiveDeck,
  restorePoint: SchedulerRestorePoint,
): ScheduledPairProjection {
  const scheduledRound = projectScheduledRound(activeDeck, restorePoint)
  const shape = getScheduleShape(activeDeck.valueIds.length)
  const matchIndex = restorePoint.cursor % shape.matchesPerRound
  const pair = scheduledRound.pairs[matchIndex]

  if (!pair) {
    throw new Error(
      `Scheduled pair is missing at cursor ${restorePoint.cursor}`,
    )
  }

  return Object.freeze({
    cursor: restorePoint.cursor,
    presentationRoundIndex: scheduledRound.presentationRoundIndex,
    sourceRoundIndex: scheduledRound.sourceRoundIndex,
    matchIndex,
    pair,
  })
}

export function advanceSchedulerCursor(
  activeDeck: ActiveDeck,
  restorePoint: SchedulerRestorePoint,
) {
  assertSchedulerRestorePoint(activeDeck, restorePoint)

  const nextCursor = restorePoint.cursor + 1
  if (nextCursor === getPairCount(activeDeck.valueIds.length)) {
    return null
  }

  return createSchedulerRestorePoint({
    activeDeck,
    progressGeneration: restorePoint.progressGeneration,
    deckRevision: restorePoint.deckRevision,
    seed: restorePoint.seed,
    cycleIndex: restorePoint.cycleIndex,
    cursor: nextCursor,
  })
}
