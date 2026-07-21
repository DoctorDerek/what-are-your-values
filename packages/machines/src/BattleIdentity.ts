import type { ScheduleKind, SchedulerIdentity } from "./SchedulerIdentity"

declare const battleIdBrand: unique symbol

export type BattleId = string & {
  readonly [battleIdBrand]: "battle"
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
