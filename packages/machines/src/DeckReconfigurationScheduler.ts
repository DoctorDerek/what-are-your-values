import { getPairCount, type ActiveDeck } from "@game/data/src/ActiveDeck"
import type { CustomValueId, ValueId, ValuePair } from "@game/data/src/Value"
import { shuffleDeterministically } from "./DeterministicSequence"
import {
  createJoinPassRestorePoint,
  projectJoinPassPair,
} from "./JoinPassScheduler"
import {
  createPairOrientationContext,
  type PairOrientationContext,
} from "./PairOrientation"
import { getScheduleShape } from "./PairScheduler"
import { avoidImmediateBoundaryRepeat } from "./PairSpacing"
import { deriveRoundRobinPairs } from "./RoundRobinPairs"
import {
  assertSchedulerIdentity,
  JOIN_PASS_SCHEDULE_KIND,
  PAIR_SCHEDULER_ALGORITHM_VERSION,
  type SchedulerCursor,
  type SchedulerIdentity,
} from "./SchedulerIdentity"

export type DeckReconfigurationRestorePoint = SchedulerIdentity<
  typeof JOIN_PASS_SCHEDULE_KIND
> & {
  readonly retainedValueIds: readonly ValueId[]
  readonly joinedValueIds: readonly CustomValueId[]
  readonly joinPairCount: number
  readonly retainedPairCount: number
  readonly pairCount: number
}

export type DeckReconfigurationPairProjection = {
  readonly cursor: SchedulerCursor
  readonly pairKind: "joined-retained" | "joined-joined" | "retained-retained"
  readonly sourceCursor: SchedulerCursor
  readonly pair: ValuePair
}

type RetainedProjectionContext = {
  readonly identity: string
  readonly orientation: PairOrientationContext
  readonly participantOrder: readonly ValueId[]
  readonly roundOrder: readonly number[]
}

function createReconfigurationIdentity(
  restorePoint: DeckReconfigurationRestorePoint,
) {
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

function assertDeckReconfigurationRestorePoint(
  activeDeck: ActiveDeck,
  restorePoint: DeckReconfigurationRestorePoint,
) {
  assertSchedulerIdentity({
    activeDeck,
    identity: restorePoint,
    expectedScheduleKind: JOIN_PASS_SCHEDULE_KIND,
    pairCount: restorePoint.pairCount,
  })

  const joinPass = createJoinPassRestorePoint({
    activeDeck,
    joinedValueIds: restorePoint.joinedValueIds,
    progressGeneration: restorePoint.progressGeneration,
    deckRevision: restorePoint.deckRevision,
    seed: restorePoint.seed,
    cycleIndex: restorePoint.cycleIndex,
  })
  const retainedPairCount = getPairCount(joinPass.retainedValueIds.length)
  const pairCount = getPairCount(activeDeck.valueIds.length)

  if (restorePoint.joinPairCount !== joinPass.pairCount) {
    throw new Error(
      `Invalid deck-reconfiguration join pair count: ${restorePoint.joinPairCount}`,
    )
  }

  if (restorePoint.retainedPairCount !== retainedPairCount) {
    throw new Error(
      `Invalid deck-reconfiguration retained pair count: ${restorePoint.retainedPairCount}`,
    )
  }

  if (
    restorePoint.pairCount !== pairCount ||
    restorePoint.joinPairCount + restorePoint.retainedPairCount !== pairCount
  ) {
    throw new Error(
      `Invalid deck-reconfiguration pair count: ${restorePoint.pairCount}`,
    )
  }

  if (
    restorePoint.retainedValueIds.length !== joinPass.retainedValueIds.length ||
    restorePoint.retainedValueIds.some(
      (valueId, index) => valueId !== joinPass.retainedValueIds[index],
    )
  ) {
    throw new Error(
      "Deck-reconfiguration retained IDs do not match the Join Pass",
    )
  }

  if (
    restorePoint.joinedValueIds.length !== joinPass.joinedValueIds.length ||
    restorePoint.joinedValueIds.some(
      (valueId, index) => valueId !== joinPass.joinedValueIds[index],
    )
  ) {
    throw new Error(
      "Deck-reconfiguration joined IDs do not match the Join Pass",
    )
  }
}

function createRetainedProjectionContext(
  activeDeck: ActiveDeck,
  restorePoint: DeckReconfigurationRestorePoint,
): RetainedProjectionContext {
  const identity = createReconfigurationIdentity(restorePoint)
  const shape = getScheduleShape(restorePoint.retainedValueIds.length)

  return {
    identity,
    orientation: createPairOrientationContext(activeDeck.valueIds),
    participantOrder: Object.freeze(
      shuffleDeterministically(
        restorePoint.retainedValueIds,
        `${identity}:retained-participants`,
      ),
    ),
    roundOrder: Object.freeze(
      shuffleDeterministically(
        Array.from({ length: shape.roundCount }, (_, index) => index),
        `${identity}:retained-rounds`,
      ),
    ),
  }
}

function deriveRetainedRoundPairs(
  context: RetainedProjectionContext,
  presentationRoundIndex: number,
  cycleIndex: number,
) {
  const sourceRoundIndex = context.roundOrder[presentationRoundIndex]
  let pairs: readonly ValuePair[] = deriveRoundRobinPairs({
    participantOrder: context.participantOrder,
    sourceRoundIndex,
    orientation: context.orientation,
    cycleIndex,
    matchOrderSeed: `${context.identity}:retained-matches:${sourceRoundIndex}`,
  })

  if (presentationRoundIndex > 0) {
    const previousSourceRoundIndex =
      context.roundOrder[presentationRoundIndex - 1]
    const previousRoundLastPair = deriveRoundRobinPairs({
      participantOrder: context.participantOrder,
      sourceRoundIndex: previousSourceRoundIndex,
      orientation: context.orientation,
      cycleIndex,
      matchOrderSeed: `${context.identity}:retained-matches:${previousSourceRoundIndex}`,
    }).at(-1)

    if (!previousRoundLastPair) {
      throw new Error(
        "Deck-reconfiguration schedule has no previous retained pair",
      )
    }

    pairs = avoidImmediateBoundaryRepeat(pairs, previousRoundLastPair)
  }

  return pairs
}

function projectRetainedPair(
  activeDeck: ActiveDeck,
  restorePoint: DeckReconfigurationRestorePoint,
  cursor: number,
) {
  const context = createRetainedProjectionContext(activeDeck, restorePoint)
  const shape = getScheduleShape(restorePoint.retainedValueIds.length)
  const presentationRoundIndex = Math.floor(cursor / shape.matchesPerRound)
  const matchIndex = cursor % shape.matchesPerRound
  const pair = deriveRetainedRoundPairs(
    context,
    presentationRoundIndex,
    restorePoint.cycleIndex,
  )[matchIndex]

  if (!pair) {
    throw new Error(
      `Deck-reconfiguration retained pair is missing at cursor ${cursor}`,
    )
  }

  return pair
}

function projectInterleavedSource(
  restorePoint: DeckReconfigurationRestorePoint,
) {
  const interleavedPairCount =
    2 * Math.min(restorePoint.joinPairCount, restorePoint.retainedPairCount)

  if (restorePoint.cursor < interleavedPairCount) {
    return restorePoint.cursor % 2 === 0
      ? {
          pairKind: "join" as const,
          sourceCursor: restorePoint.cursor / 2,
        }
      : {
          pairKind: "retained" as const,
          sourceCursor: (restorePoint.cursor - 1) / 2,
        }
  }

  const remainingCursor = restorePoint.cursor - interleavedPairCount
  return restorePoint.joinPairCount > restorePoint.retainedPairCount
    ? {
        pairKind: "join" as const,
        sourceCursor: restorePoint.retainedPairCount + remainingCursor,
      }
    : {
        pairKind: "retained" as const,
        sourceCursor: restorePoint.joinPairCount + remainingCursor,
      }
}

export function createDeckReconfigurationRestorePoint({
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
  const joinPass = createJoinPassRestorePoint({
    activeDeck,
    joinedValueIds,
    progressGeneration,
    deckRevision,
    seed,
    cycleIndex,
  })
  const retainedPairCount = getPairCount(joinPass.retainedValueIds.length)
  const restorePoint = Object.freeze({
    algorithmVersion: PAIR_SCHEDULER_ALGORITHM_VERSION,
    activeDeckFingerprint: activeDeck.fingerprint,
    progressGeneration,
    deckRevision,
    scheduleKind: JOIN_PASS_SCHEDULE_KIND,
    seed,
    cycleIndex,
    cursor: cursor as SchedulerCursor,
    retainedValueIds: joinPass.retainedValueIds,
    joinedValueIds: joinPass.joinedValueIds,
    joinPairCount: joinPass.pairCount,
    retainedPairCount,
    pairCount: joinPass.pairCount + retainedPairCount,
  }) satisfies DeckReconfigurationRestorePoint

  assertDeckReconfigurationRestorePoint(activeDeck, restorePoint)
  return restorePoint
}

export function projectDeckReconfigurationPair(
  activeDeck: ActiveDeck,
  restorePoint: DeckReconfigurationRestorePoint,
): DeckReconfigurationPairProjection {
  assertDeckReconfigurationRestorePoint(activeDeck, restorePoint)

  const source = projectInterleavedSource(restorePoint)
  if (source.pairKind === "join") {
    const projection = projectJoinPassPair(
      activeDeck,
      createJoinPassRestorePoint({
        activeDeck,
        joinedValueIds: restorePoint.joinedValueIds,
        progressGeneration: restorePoint.progressGeneration,
        deckRevision: restorePoint.deckRevision,
        seed: restorePoint.seed,
        cycleIndex: restorePoint.cycleIndex,
        cursor: source.sourceCursor,
      }),
    )

    return Object.freeze({
      cursor: restorePoint.cursor,
      pairKind: projection.pairKind,
      sourceCursor: source.sourceCursor as SchedulerCursor,
      pair: projection.pair,
    })
  }

  return Object.freeze({
    cursor: restorePoint.cursor,
    pairKind: "retained-retained",
    sourceCursor: source.sourceCursor as SchedulerCursor,
    pair: projectRetainedPair(activeDeck, restorePoint, source.sourceCursor),
  })
}

export function advanceDeckReconfigurationCursor(
  activeDeck: ActiveDeck,
  restorePoint: DeckReconfigurationRestorePoint,
) {
  assertDeckReconfigurationRestorePoint(activeDeck, restorePoint)

  const nextCursor = restorePoint.cursor + 1
  if (nextCursor === restorePoint.pairCount) {
    return null
  }

  return createDeckReconfigurationRestorePoint({
    activeDeck,
    joinedValueIds: restorePoint.joinedValueIds,
    progressGeneration: restorePoint.progressGeneration,
    deckRevision: restorePoint.deckRevision,
    seed: restorePoint.seed,
    cycleIndex: restorePoint.cycleIndex,
    cursor: nextCursor,
  })
}
