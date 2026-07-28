import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import {
  advanceDeckReconfigurationCursor,
  projectDeckReconfigurationPair,
  type DeckReconfigurationRestorePoint,
} from "./DeckReconfigurationScheduler"
import {
  advanceSchedulerCursor,
  createSchedulerRestorePoint,
  projectScheduledPair,
  type SchedulerRestorePoint,
} from "./PairScheduler"
import { JOIN_PASS_SCHEDULE_KIND } from "./SchedulerIdentity"

export type BattleSchedulerRestorePoint =
  SchedulerRestorePoint | DeckReconfigurationRestorePoint

export function projectBattlePair(
  activeDeck: ActiveDeck,
  scheduler: BattleSchedulerRestorePoint,
) {
  return scheduler.scheduleKind === JOIN_PASS_SCHEDULE_KIND
    ? projectDeckReconfigurationPair(activeDeck, scheduler).pair
    : projectScheduledPair(activeDeck, scheduler).pair
}

export function advanceBattleScheduler(
  activeDeck: ActiveDeck,
  scheduler: BattleSchedulerRestorePoint,
) {
  return scheduler.scheduleKind === JOIN_PASS_SCHEDULE_KIND
    ? advanceDeckReconfigurationCursor(activeDeck, scheduler)
    : advanceSchedulerCursor(activeDeck, scheduler)
}

export function createNextCycleScheduler(
  activeDeck: ActiveDeck,
  scheduler: BattleSchedulerRestorePoint,
) {
  if (scheduler.cycleIndex === Number.MAX_SAFE_INTEGER) {
    throw new Error("Pair cycle index cannot be incremented safely")
  }

  return createSchedulerRestorePoint({
    activeDeck,
    progressGeneration: scheduler.progressGeneration,
    deckRevision: scheduler.deckRevision,
    seed: scheduler.seed,
    cycleIndex: scheduler.cycleIndex + 1,
  })
}
