import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createSchedulerRestorePoint,
  type SchedulerRestorePoint,
} from "./PairScheduler"
import {
  readNonNegativeSafeInteger,
  readString,
  readTuple,
} from "./PersistenceValidation"
import {
  FULL_CYCLE_SCHEDULE_KIND,
  PAIR_SCHEDULER_ALGORITHM_VERSION,
} from "./SchedulerIdentity"

export type EncodedSchedulerRestorePoint = readonly [
  algorithmVersion: number,
  activeDeckFingerprint: string,
  progressGeneration: number,
  deckRevision: number,
  scheduleKind: string,
  seed: string,
  cycleIndex: number,
  cursor: number,
]

export function encodeSchedulerRestorePoint(
  scheduler: SchedulerRestorePoint,
): EncodedSchedulerRestorePoint {
  return [
    scheduler.algorithmVersion,
    scheduler.activeDeckFingerprint,
    scheduler.progressGeneration,
    scheduler.deckRevision,
    scheduler.scheduleKind,
    scheduler.seed,
    scheduler.cycleIndex,
    scheduler.cursor,
  ]
}

export function decodeSchedulerRestorePoint(
  activeDeck: ActiveDeck,
  value: unknown,
  label: string,
) {
  const tuple = readTuple(value, 8, label)
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
  if (scheduleKind !== FULL_CYCLE_SCHEDULE_KIND) {
    throw new Error(`Unsupported ${label} schedule kind`)
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
