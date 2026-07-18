import {
  getPairCount,
  type ActiveDeck,
  type ActiveDeckFingerprint,
} from "@game/data/src/ActiveDeck"
import type { ValueId, ValuePair } from "@game/data/src/Value"
import { shuffleDeterministically } from "./DeterministicSequence"

declare const schedulerCursorBrand: unique symbol

export const PAIR_SCHEDULER_ALGORITHM_VERSION = 1 as const
export const FULL_CYCLE_SCHEDULE_KIND = "full-cycle" as const

export type SchedulerCursor = number & {
  readonly [schedulerCursorBrand]: "scheduler-cursor"
}

export type SchedulerRestorePoint = {
  readonly algorithmVersion: typeof PAIR_SCHEDULER_ALGORITHM_VERSION
  readonly activeDeckFingerprint: ActiveDeckFingerprint
  readonly progressGeneration: number
  readonly deckRevision: number
  readonly scheduleKind: typeof FULL_CYCLE_SCHEDULE_KIND
  readonly seed: string
  readonly cycleIndex: number
  readonly cursor: SchedulerCursor
}

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

const internalBye: unique symbol = Symbol("internal-bye")
type CircleParticipant = ValueId | typeof internalBye

function isActiveValue(participant: CircleParticipant): participant is ValueId {
  return participant !== internalBye
}

type CycleProjectionContext = {
  readonly activeValueCount: number
  readonly cycleIdentity: string
  readonly orientationIndexes: ReadonlyMap<ValueId, number>
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
  const orientationIndexes = new Map(
    activeDeck.valueIds.map((valueId, index) => [valueId, index]),
  )
  const roundOrder = Object.freeze(
    shuffleDeterministically(
      Array.from({ length: shape.roundCount }, (_, index) => index),
      `${cycleIdentity}:rounds`,
    ),
  )

  return {
    activeValueCount: activeDeck.valueIds.length,
    cycleIdentity,
    orientationIndexes,
    participantOrder,
    roundOrder,
    shape,
  }
}

function rotateCircleParticipants(
  participants: readonly CircleParticipant[],
  sourceRoundIndex: number,
): CircleParticipant[] {
  const fixedParticipant = participants[0]
  const rotatingParticipants = participants.slice(1)
  const rotation = sourceRoundIndex % rotatingParticipants.length
  const splitIndex = rotatingParticipants.length - rotation

  return [
    fixedParticipant,
    ...rotatingParticipants.slice(splitIndex),
    ...rotatingParticipants.slice(0, splitIndex),
  ]
}

function orientPair(
  first: ValueId,
  second: ValueId,
  context: CycleProjectionContext,
  cycleIndex: number,
): ValuePair {
  const firstIndex = context.orientationIndexes.get(first)
  const secondIndex = context.orientationIndexes.get(second)

  if (firstIndex === undefined || secondIndex === undefined) {
    throw new Error("Scheduled pair contains an unknown active value")
  }

  const orientationSize =
    context.activeValueCount % 2 === 0
      ? context.activeValueCount + 1
      : context.activeValueCount
  const forwardDistance =
    (secondIndex - firstIndex + orientationSize) % orientationSize
  const firstLeads = forwardDistance <= (orientationSize - 1) / 2
  const invertCycle = context.activeValueCount % 2 === 0 && cycleIndex % 2 === 1
  const orientedFirstLeads = invertCycle ? !firstLeads : firstLeads

  return Object.freeze(
    orientedFirstLeads ? [first, second] : [second, first],
  ) as ValuePair
}

function deriveBaseRoundPairs(
  context: CycleProjectionContext,
  sourceRoundIndex: number,
  cycleIndex: number,
) {
  const circleParticipants: readonly CircleParticipant[] =
    context.activeValueCount % 2 === 0
      ? context.participantOrder
      : [...context.participantOrder, internalBye]
  const rotatedParticipants = rotateCircleParticipants(
    circleParticipants,
    sourceRoundIndex,
  )
  const pairs: ValuePair[] = []

  for (let index = 0; index < rotatedParticipants.length / 2; index += 1) {
    const first = rotatedParticipants[index]
    const second = rotatedParticipants[rotatedParticipants.length - 1 - index]

    if (isActiveValue(first) && isActiveValue(second)) {
      pairs.push(orientPair(first, second, context, cycleIndex))
    }
  }

  return shuffleDeterministically(
    pairs,
    `${context.cycleIdentity}:matches:${sourceRoundIndex}`,
  )
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
  if (restorePoint.algorithmVersion !== PAIR_SCHEDULER_ALGORITHM_VERSION) {
    throw new Error(
      `Unsupported pair scheduler algorithm: ${restorePoint.algorithmVersion}`,
    )
  }

  if (restorePoint.activeDeckFingerprint !== activeDeck.fingerprint) {
    throw new Error("Scheduler Active Deck fingerprint does not match")
  }

  if (restorePoint.scheduleKind !== FULL_CYCLE_SCHEDULE_KIND) {
    throw new Error(`Unsupported schedule kind: ${restorePoint.scheduleKind}`)
  }

  if (
    !Number.isSafeInteger(restorePoint.progressGeneration) ||
    restorePoint.progressGeneration < 0
  ) {
    throw new Error(
      `Invalid progress generation: ${restorePoint.progressGeneration}`,
    )
  }

  if (
    !Number.isSafeInteger(restorePoint.deckRevision) ||
    restorePoint.deckRevision < 0
  ) {
    throw new Error(`Invalid deck revision: ${restorePoint.deckRevision}`)
  }

  if (restorePoint.seed.length === 0) {
    throw new Error("Scheduler seed is required")
  }

  if (
    !Number.isSafeInteger(restorePoint.cycleIndex) ||
    restorePoint.cycleIndex < 0
  ) {
    throw new Error(`Invalid cycle index: ${restorePoint.cycleIndex}`)
  }

  const pairCount = getPairCount(activeDeck.valueIds.length)
  if (
    !Number.isSafeInteger(restorePoint.cursor) ||
    restorePoint.cursor < 0 ||
    restorePoint.cursor >= pairCount
  ) {
    throw new Error(`Invalid scheduler cursor: ${restorePoint.cursor}`)
  }
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
