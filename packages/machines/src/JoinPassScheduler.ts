import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import {
  isCustomValueId,
  type CustomValueId,
  type ValueId,
  type ValuePair,
} from "@game/data/src/Value"
import { shuffleDeterministically } from "./DeterministicSequence"
import {
  createPairOrientationContext,
  orientValuePair,
  type PairOrientationContext,
} from "./PairOrientation"
import { preserveBoundarySpacingWhenPossible } from "./PairSpacing"
import { deriveRoundRobinPairs } from "./RoundRobinPairs"
import {
  assertSchedulerIdentity,
  JOIN_PASS_SCHEDULE_KIND,
  PAIR_SCHEDULER_ALGORITHM_VERSION,
  type SchedulerCursor,
  type SchedulerIdentity,
} from "./SchedulerIdentity"

const maximumSafeInteger = BigInt(Number.MAX_SAFE_INTEGER)

export type JoinPassRestorePoint = SchedulerIdentity<
  typeof JOIN_PASS_SCHEDULE_KIND
> & {
  readonly retainedValueIds: readonly ValueId[]
  readonly joinedValueIds: readonly CustomValueId[]
  readonly pairCount: number
}

export type JoinPassPairProjection = {
  readonly cursor: SchedulerCursor
  readonly pairKind: "joined-retained" | "joined-joined"
  readonly pair: ValuePair
}

type JoinPassProjectionContext = {
  readonly identity: string
  readonly retainedOrder: readonly ValueId[]
  readonly joinedOrder: readonly CustomValueId[]
  readonly crossPairCount: number
  readonly orientation: PairOrientationContext
  readonly joinedRoundOrder: readonly number[]
}

function assertSafeCount(value: number, label: string) {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

export function getJoinPassPairCount(
  activeValueCount: number,
  joinedValueCount: number,
) {
  assertSafeCount(activeValueCount, "active value count")
  assertSafeCount(joinedValueCount, "joined value count")

  if (activeValueCount < 2) {
    throw new Error(`Invalid active value count: ${activeValueCount}`)
  }

  if (joinedValueCount < 1 || joinedValueCount > activeValueCount) {
    throw new Error(`Invalid joined value count: ${joinedValueCount}`)
  }

  const activeCount = BigInt(activeValueCount)
  const joinedCount = BigInt(joinedValueCount)
  const pairCount = (joinedCount * (2n * activeCount - joinedCount - 1n)) / 2n

  if (pairCount > maximumSafeInteger) {
    throw new Error(
      `Unsafe Join Pass pair count for N=${activeValueCount}, K=${joinedValueCount}`,
    )
  }

  return Number(pairCount)
}

function assertOrderedIds(
  label: string,
  actual: readonly ValueId[],
  expected: readonly ValueId[],
) {
  if (
    actual.length !== expected.length ||
    actual.some((valueId, index) => valueId !== expected[index])
  ) {
    throw new Error(`Join Pass ${label} do not match the Active Deck`)
  }
}

function assertJoinPassMembership(
  activeDeck: ActiveDeck,
  restorePoint: JoinPassRestorePoint,
) {
  if (restorePoint.joinedValueIds.length === 0) {
    throw new Error("Join Pass requires at least one joined Custom Value")
  }

  const joinedValueIds = new Set<ValueId>(restorePoint.joinedValueIds)
  if (joinedValueIds.size !== restorePoint.joinedValueIds.length) {
    throw new Error("Join Pass contains duplicate joined Value IDs")
  }

  if (
    restorePoint.joinedValueIds.some((valueId) => !isCustomValueId(valueId))
  ) {
    throw new Error("Join Pass joined IDs must be Custom Value IDs")
  }

  const retainedValueIds = new Set(restorePoint.retainedValueIds)
  if (retainedValueIds.size !== restorePoint.retainedValueIds.length) {
    throw new Error("Join Pass contains duplicate retained Value IDs")
  }

  if (
    restorePoint.retainedValueIds.some((valueId) => joinedValueIds.has(valueId))
  ) {
    throw new Error("Join Pass retained and joined Value IDs overlap")
  }

  const expectedJoinedValueIds = activeDeck.valueIds.filter((valueId) =>
    joinedValueIds.has(valueId),
  )
  const expectedRetainedValueIds = activeDeck.valueIds.filter(
    (valueId) => !joinedValueIds.has(valueId),
  )

  assertOrderedIds(
    "joined Value IDs",
    restorePoint.joinedValueIds,
    expectedJoinedValueIds,
  )
  assertOrderedIds(
    "retained Value IDs",
    restorePoint.retainedValueIds,
    expectedRetainedValueIds,
  )

  const expectedPairCount = getJoinPassPairCount(
    activeDeck.valueIds.length,
    restorePoint.joinedValueIds.length,
  )
  if (restorePoint.pairCount !== expectedPairCount) {
    throw new Error(`Invalid Join Pass pair count: ${restorePoint.pairCount}`)
  }
}

function assertJoinPassRestorePoint(
  activeDeck: ActiveDeck,
  restorePoint: JoinPassRestorePoint,
) {
  assertSchedulerIdentity({
    activeDeck,
    identity: restorePoint,
    expectedScheduleKind: JOIN_PASS_SCHEDULE_KIND,
    pairCount: restorePoint.pairCount,
  })
  assertJoinPassMembership(activeDeck, restorePoint)
}

function createJoinPassIdentity(restorePoint: JoinPassRestorePoint) {
  return JSON.stringify([
    restorePoint.algorithmVersion,
    restorePoint.activeDeckFingerprint,
    restorePoint.progressGeneration,
    restorePoint.deckRevision,
    restorePoint.scheduleKind,
    restorePoint.seed,
    restorePoint.cycleIndex,
    restorePoint.retainedValueIds,
    restorePoint.joinedValueIds,
  ])
}

function createJoinPassProjectionContext(
  activeDeck: ActiveDeck,
  restorePoint: JoinPassRestorePoint,
): JoinPassProjectionContext {
  const identity = createJoinPassIdentity(restorePoint)
  const joinedRoundCount =
    restorePoint.joinedValueIds.length % 2 === 0
      ? restorePoint.joinedValueIds.length - 1
      : restorePoint.joinedValueIds.length

  return {
    identity,
    retainedOrder: Object.freeze(
      shuffleDeterministically(
        restorePoint.retainedValueIds,
        `${identity}:retained`,
      ),
    ),
    joinedOrder: Object.freeze(
      shuffleDeterministically(
        restorePoint.joinedValueIds,
        `${identity}:joined`,
      ),
    ),
    crossPairCount:
      restorePoint.joinedValueIds.length * restorePoint.retainedValueIds.length,
    orientation: createPairOrientationContext(activeDeck.valueIds),
    joinedRoundOrder: Object.freeze(
      shuffleDeterministically(
        Array.from({ length: joinedRoundCount }, (_, index) => index),
        `${identity}:joined-rounds`,
      ),
    ),
  }
}

function getBoundaryRotationStep(smallCount: number, largeCount: number) {
  if (smallCount < 2) {
    return 0
  }

  for (let candidate = 0; candidate < smallCount; candidate += 1) {
    const repeatsSmallParticipant = candidate === smallCount - 1
    const repeatsLargeParticipant =
      (smallCount - 2 - candidate) % largeCount === 0

    if (!repeatsSmallParticipant && !repeatsLargeParticipant) {
      return candidate
    }
  }

  return 0
}

function projectCompleteBipartitePair(
  firstGroup: readonly ValueId[],
  secondGroup: readonly ValueId[],
  cursor: number,
): readonly [ValueId, ValueId] {
  const firstGroupIsSmall = firstGroup.length <= secondGroup.length
  const smallGroup = firstGroupIsSmall ? firstGroup : secondGroup
  const largeGroup = firstGroupIsSmall ? secondGroup : firstGroup
  const roundIndex = Math.floor(cursor / smallGroup.length)
  const matchIndex = cursor % smallGroup.length
  const rotationStep = getBoundaryRotationStep(
    smallGroup.length,
    largeGroup.length,
  )
  const rotation = (roundIndex * rotationStep) % smallGroup.length
  const smallIndex = (matchIndex + rotation) % smallGroup.length
  const largeIndex = (roundIndex + smallIndex) % largeGroup.length

  return firstGroupIsSmall
    ? [smallGroup[smallIndex], largeGroup[largeIndex]]
    : [largeGroup[largeIndex], smallGroup[smallIndex]]
}

function projectJoinedRetainedPair(
  context: JoinPassProjectionContext,
  cursor: number,
  cycleIndex: number,
) {
  const [joinedValueId, retainedValueId] = projectCompleteBipartitePair(
    context.joinedOrder,
    context.retainedOrder,
    cursor,
  )

  return orientValuePair(
    joinedValueId,
    retainedValueId,
    context.orientation,
    cycleIndex,
  )
}

function deriveJoinedRoundPairs(
  context: JoinPassProjectionContext,
  presentationRoundIndex: number,
  cycleIndex: number,
) {
  const sourceRoundIndex = context.joinedRoundOrder[presentationRoundIndex]
  let pairs: readonly ValuePair[] = deriveRoundRobinPairs({
    participantOrder: context.joinedOrder,
    sourceRoundIndex,
    orientation: context.orientation,
    cycleIndex,
    matchOrderSeed: `${context.identity}:joined-matches:${sourceRoundIndex}`,
  })

  if (presentationRoundIndex === 0 && context.crossPairCount > 0) {
    pairs = preserveBoundarySpacingWhenPossible(
      pairs,
      projectJoinedRetainedPair(
        context,
        context.crossPairCount - 1,
        cycleIndex,
      ),
    )
  }

  if (presentationRoundIndex > 0) {
    const previousSourceRoundIndex =
      context.joinedRoundOrder[presentationRoundIndex - 1]
    const previousRoundLastPair = deriveRoundRobinPairs({
      participantOrder: context.joinedOrder,
      sourceRoundIndex: previousSourceRoundIndex,
      orientation: context.orientation,
      cycleIndex,
      matchOrderSeed: `${context.identity}:joined-matches:${previousSourceRoundIndex}`,
    }).at(-1)

    if (!previousRoundLastPair) {
      throw new Error("Join Pass does not contain a previous joined pair")
    }

    pairs = preserveBoundarySpacingWhenPossible(pairs, previousRoundLastPair)
  }

  return pairs
}

function projectJoinedPair(
  context: JoinPassProjectionContext,
  cursor: number,
  cycleIndex: number,
) {
  const matchesPerRound = Math.floor(context.joinedOrder.length / 2)
  const presentationRoundIndex = Math.floor(cursor / matchesPerRound)
  const matchIndex = cursor % matchesPerRound
  const pair = deriveJoinedRoundPairs(
    context,
    presentationRoundIndex,
    cycleIndex,
  )[matchIndex]

  if (!pair) {
    throw new Error(`Join Pass joined pair is missing at cursor ${cursor}`)
  }

  return pair
}

export function createJoinPassRestorePoint({
  activeDeck,
  joinedValueIds,
  progressGeneration,
  deckRevision,
  seed,
  cycleIndex,
  cursor = 0,
}: {
  readonly activeDeck: ActiveDeck
  readonly joinedValueIds: readonly CustomValueId[]
  readonly progressGeneration: number
  readonly deckRevision: number
  readonly seed: string
  readonly cycleIndex: number
  readonly cursor?: number
}) {
  if (joinedValueIds.some((valueId) => !isCustomValueId(valueId))) {
    throw new Error("Join Pass joined IDs must be Custom Value IDs")
  }

  const joinedValueIdSet = new Set<ValueId>(joinedValueIds)
  if (joinedValueIdSet.size !== joinedValueIds.length) {
    throw new Error("Join Pass contains duplicate joined Value IDs")
  }

  const orderedJoinedValueIds = Object.freeze(
    activeDeck.valueIds.filter(
      (valueId): valueId is CustomValueId =>
        isCustomValueId(valueId) && joinedValueIdSet.has(valueId),
    ),
  )
  const retainedValueIds = Object.freeze(
    activeDeck.valueIds.filter((valueId) => !joinedValueIdSet.has(valueId)),
  )

  if (orderedJoinedValueIds.length !== joinedValueIds.length) {
    throw new Error("Join Pass joined Value IDs do not match the Active Deck")
  }

  const restorePoint = Object.freeze({
    algorithmVersion: PAIR_SCHEDULER_ALGORITHM_VERSION,
    activeDeckFingerprint: activeDeck.fingerprint,
    progressGeneration,
    deckRevision,
    scheduleKind: JOIN_PASS_SCHEDULE_KIND,
    seed,
    cycleIndex,
    cursor: cursor as SchedulerCursor,
    retainedValueIds,
    joinedValueIds: orderedJoinedValueIds,
    pairCount: getJoinPassPairCount(
      activeDeck.valueIds.length,
      orderedJoinedValueIds.length,
    ),
  }) satisfies JoinPassRestorePoint

  assertJoinPassRestorePoint(activeDeck, restorePoint)
  return restorePoint
}

export function projectJoinPassPair(
  activeDeck: ActiveDeck,
  restorePoint: JoinPassRestorePoint,
): JoinPassPairProjection {
  assertJoinPassRestorePoint(activeDeck, restorePoint)

  const context = createJoinPassProjectionContext(activeDeck, restorePoint)
  const joinedRetainedPair = restorePoint.cursor < context.crossPairCount
  const pair = joinedRetainedPair
    ? projectJoinedRetainedPair(
        context,
        restorePoint.cursor,
        restorePoint.cycleIndex,
      )
    : projectJoinedPair(
        context,
        restorePoint.cursor - context.crossPairCount,
        restorePoint.cycleIndex,
      )

  return Object.freeze({
    cursor: restorePoint.cursor,
    pairKind: joinedRetainedPair ? "joined-retained" : "joined-joined",
    pair,
  })
}

export function advanceJoinPassCursor(
  activeDeck: ActiveDeck,
  restorePoint: JoinPassRestorePoint,
) {
  assertJoinPassRestorePoint(activeDeck, restorePoint)

  const nextCursor = restorePoint.cursor + 1
  if (nextCursor === restorePoint.pairCount) {
    return null
  }

  return createJoinPassRestorePoint({
    activeDeck,
    joinedValueIds: restorePoint.joinedValueIds,
    progressGeneration: restorePoint.progressGeneration,
    deckRevision: restorePoint.deckRevision,
    seed: restorePoint.seed,
    cycleIndex: restorePoint.cycleIndex,
    cursor: nextCursor,
  })
}
