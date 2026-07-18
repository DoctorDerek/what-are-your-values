import type {
  ActiveDeck,
  ActiveDeckFingerprint,
} from "@game/data/src/ActiveDeck"

declare const schedulerCursorBrand: unique symbol

export const PAIR_SCHEDULER_ALGORITHM_VERSION = 1 as const
export const FULL_CYCLE_SCHEDULE_KIND = "full-cycle" as const
export const JOIN_PASS_SCHEDULE_KIND = "join-pass" as const

export type ScheduleKind =
  typeof FULL_CYCLE_SCHEDULE_KIND | typeof JOIN_PASS_SCHEDULE_KIND

export type SchedulerCursor = number & {
  readonly [schedulerCursorBrand]: "scheduler-cursor"
}

export type SchedulerIdentity<TScheduleKind extends ScheduleKind> = {
  readonly algorithmVersion: typeof PAIR_SCHEDULER_ALGORITHM_VERSION
  readonly activeDeckFingerprint: ActiveDeckFingerprint
  readonly progressGeneration: number
  readonly deckRevision: number
  readonly scheduleKind: TScheduleKind
  readonly seed: string
  readonly cycleIndex: number
  readonly cursor: SchedulerCursor
}

export function assertSchedulerIdentity<TScheduleKind extends ScheduleKind>({
  activeDeck,
  identity,
  expectedScheduleKind,
  pairCount,
}: {
  readonly activeDeck: ActiveDeck
  readonly identity: SchedulerIdentity<TScheduleKind>
  readonly expectedScheduleKind: TScheduleKind
  readonly pairCount: number
}) {
  if (identity.algorithmVersion !== PAIR_SCHEDULER_ALGORITHM_VERSION) {
    throw new Error(
      `Unsupported pair scheduler algorithm: ${identity.algorithmVersion}`,
    )
  }

  if (identity.activeDeckFingerprint !== activeDeck.fingerprint) {
    throw new Error("Scheduler Active Deck fingerprint does not match")
  }

  if (identity.scheduleKind !== expectedScheduleKind) {
    throw new Error(`Unsupported schedule kind: ${identity.scheduleKind}`)
  }

  if (
    !Number.isSafeInteger(identity.progressGeneration) ||
    identity.progressGeneration < 0
  ) {
    throw new Error(
      `Invalid progress generation: ${identity.progressGeneration}`,
    )
  }

  if (
    !Number.isSafeInteger(identity.deckRevision) ||
    identity.deckRevision < 0
  ) {
    throw new Error(`Invalid deck revision: ${identity.deckRevision}`)
  }

  if (identity.seed.length === 0) {
    throw new Error("Scheduler seed is required")
  }

  if (!Number.isSafeInteger(identity.cycleIndex) || identity.cycleIndex < 0) {
    throw new Error(`Invalid cycle index: ${identity.cycleIndex}`)
  }

  if (
    !Number.isSafeInteger(identity.cursor) ||
    identity.cursor < 0 ||
    identity.cursor >= pairCount
  ) {
    throw new Error(`Invalid scheduler cursor: ${identity.cursor}`)
  }
}
