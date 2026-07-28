import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createCustomValueId,
  type CustomValueId,
  type ValueId,
} from "@game/data/src/Value"
import type { BattleSchedulerRestorePoint } from "./BattleScheduler"
import {
  createDeckReconfigurationRestorePoint,
  type DeckReconfigurationRestorePoint,
} from "./DeckReconfigurationScheduler"
import { createSchedulerRestorePoint } from "./PairScheduler"
import {
  readActiveValueId,
  readNonNegativeSafeInteger,
  readString,
  readTuple,
} from "./PersistenceValidation"
import {
  FULL_CYCLE_SCHEDULE_KIND,
  JOIN_PASS_SCHEDULE_KIND,
  PAIR_SCHEDULER_ALGORITHM_VERSION,
} from "./SchedulerIdentity"

type EncodedSchedulerIdentity = readonly [
  algorithmVersion: number,
  activeDeckFingerprint: string,
  progressGeneration: number,
  deckRevision: number,
  scheduleKind: string,
  seed: string,
  cycleIndex: number,
  cursor: number,
]

export type EncodedSchedulerRestorePoint =
  | EncodedSchedulerIdentity
  | readonly [
      ...identity: EncodedSchedulerIdentity,
      retainedValueIds: readonly string[],
      joinedValueIds: readonly string[],
      joinPairCount: number,
      retainedPairCount: number,
      pairCount: number,
    ]

export function encodeSchedulerRestorePoint(
  scheduler: BattleSchedulerRestorePoint,
): EncodedSchedulerRestorePoint {
  const identity: EncodedSchedulerIdentity = [
    scheduler.algorithmVersion,
    scheduler.activeDeckFingerprint,
    scheduler.progressGeneration,
    scheduler.deckRevision,
    scheduler.scheduleKind,
    scheduler.seed,
    scheduler.cycleIndex,
    scheduler.cursor,
  ]

  return scheduler.scheduleKind === JOIN_PASS_SCHEDULE_KIND
    ? [
        ...identity,
        scheduler.retainedValueIds,
        scheduler.joinedValueIds,
        scheduler.joinPairCount,
        scheduler.retainedPairCount,
        scheduler.pairCount,
      ]
    : identity
}

export function decodeSchedulerRestorePoint(
  activeDeck: ActiveDeck,
  value: unknown,
  label: string,
) {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}`)
  }

  const tuple = readTuple(value.slice(0, 8), 8, label)
  const algorithmVersion = readNonNegativeSafeInteger(
    tuple[0],
    `${label} algorithm version`,
  )
  const activeDeckFingerprint = readString(
    tuple[1],
    `${label} Active Deck fingerprint`,
  )
  const progressGeneration = readNonNegativeSafeInteger(
    tuple[2],
    `${label} progress generation`,
  )
  const deckRevision = readNonNegativeSafeInteger(
    tuple[3],
    `${label} deck revision`,
  )
  const scheduleKind = readString(tuple[4], `${label} schedule kind`)
  const seed = readString(tuple[5], `${label} seed`)
  const cycleIndex = readNonNegativeSafeInteger(
    tuple[6],
    `${label} cycle index`,
  )
  const cursor = readNonNegativeSafeInteger(tuple[7], `${label} cursor`)

  if (algorithmVersion !== PAIR_SCHEDULER_ALGORITHM_VERSION) {
    throw new Error(`Unsupported ${label} algorithm version`)
  }
  if (activeDeckFingerprint !== activeDeck.fingerprint) {
    throw new Error(`${label} Active Deck fingerprint does not match`)
  }
  if (scheduleKind === FULL_CYCLE_SCHEDULE_KIND) {
    if (value.length !== 8) {
      throw new Error(`Invalid ${label}`)
    }
    return createSchedulerRestorePoint({
      activeDeck,
      progressGeneration,
      deckRevision,
      seed,
      cycleIndex,
      cursor,
    })
  }

  if (scheduleKind !== JOIN_PASS_SCHEDULE_KIND || value.length !== 13) {
    throw new Error(`Unsupported ${label} schedule kind`)
  }

  const retainedValueIds = readEncodedValueIds(
    activeDeck,
    value[8],
    `${label} retained value IDs`,
  )
  const joinedValueIds = readEncodedCustomValueIds(
    activeDeck,
    value[9],
    `${label} joined value IDs`,
  )
  const joinPairCount = readNonNegativeSafeInteger(
    value[10],
    `${label} join pair count`,
  )
  const retainedPairCount = readNonNegativeSafeInteger(
    value[11],
    `${label} retained pair count`,
  )
  const pairCount = readNonNegativeSafeInteger(value[12], `${label} pair count`)
  const scheduler = createDeckReconfigurationRestorePoint({
    activeDeck,
    joinedValueIds,
    progressGeneration,
    deckRevision,
    seed,
    cycleIndex,
    cursor,
  })

  if (
    JSON.stringify(encodeSchedulerRestorePoint(scheduler)) !==
      JSON.stringify(value) ||
    JSON.stringify(scheduler.retainedValueIds) !==
      JSON.stringify(retainedValueIds) ||
    scheduler.joinPairCount !== joinPairCount ||
    scheduler.retainedPairCount !== retainedPairCount ||
    scheduler.pairCount !== pairCount
  ) {
    throw new Error(`${label} encoding is not canonical`)
  }

  return scheduler
}

function readEncodedValueIds(
  activeDeck: ActiveDeck,
  value: unknown,
  label: string,
) {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}`)
  }

  return Object.freeze(
    value.map((candidate, index) =>
      readActiveValueId(activeDeck, candidate, `${label} ${index}`),
    ),
  ) satisfies readonly ValueId[]
}

function readEncodedCustomValueIds(
  activeDeck: ActiveDeck,
  value: unknown,
  label: string,
) {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${label}`)
  }

  return Object.freeze(
    value.map((candidate, index) => {
      const valueId = createCustomValueId(
        readString(candidate, `${label} ${index}`),
      )
      if (!activeDeck.customValues.some(({ id }) => id === valueId)) {
        throw new Error(`${label} is not in the Active Deck: ${valueId}`)
      }
      return valueId
    }),
  ) satisfies readonly CustomValueId[]
}
