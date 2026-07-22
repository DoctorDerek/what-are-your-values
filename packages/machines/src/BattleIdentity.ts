import type { ScheduleKind, SchedulerIdentity } from "./SchedulerIdentity"

declare const battleIdBrand: unique symbol
declare const cycleCompleteEventIdBrand: unique symbol

export type BattleId = string & {
  readonly [battleIdBrand]: "battle"
}

export type CycleCompleteEventId = string & {
  readonly [cycleCompleteEventIdBrand]: "cycle-complete-event"
}

export function createBattleId(scheduler: SchedulerIdentity<ScheduleKind>) {
  return JSON.stringify([
    "battle-v1",
    scheduler.progressGeneration,
    scheduler.deckRevision,
    scheduler.activeDeckFingerprint,
    scheduler.algorithmVersion,
    scheduler.scheduleKind,
    scheduler.seed,
    scheduler.cycleIndex,
    scheduler.cursor,
  ]) as BattleId
}

export function createCycleCompleteEventId(battleId: BattleId) {
  return JSON.stringify(["cycle-complete-v1", battleId]) as CycleCompleteEventId
}
