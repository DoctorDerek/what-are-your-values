import type { CustomValueDefinition, ValueId } from "@game/data/src/Value"
import {
  applyBattleChoice,
  applyBattleRedo,
  applyBattleUndo,
  applyDeckRevision,
  type BattleProfile,
} from "./BattleProfile"
import {
  createBattleChoiceEvent,
  createBattleRedoEvent,
  createBattleUndoEvent,
  createDeckRevisionEvent,
  type BattleProfileEvent,
} from "./BattleProfileEvent"
import type { SchedulerRestorePoint } from "./PairScheduler"

export type BattleProfileCommit = {
  readonly profile: BattleProfile
  readonly event: BattleProfileEvent
}

function createBattleProfileCommit(
  profile: BattleProfile,
  event: BattleProfileEvent,
) {
  return Object.freeze({ profile, event }) satisfies BattleProfileCommit
}

export function createBattleChoiceCommit({
  profile,
  winnerId,
  expectedScheduler,
}: {
  readonly profile: BattleProfile
  readonly winnerId: ValueId
  readonly expectedScheduler: SchedulerRestorePoint
}) {
  const transition = applyBattleChoice({
    profile,
    winnerId,
    expectedScheduler,
  })

  return createBattleProfileCommit(
    transition.profile,
    createBattleChoiceEvent(transition),
  )
}

export function createBattleUndoCommit(profile: BattleProfile) {
  const transition = applyBattleUndo(profile)

  return transition
    ? createBattleProfileCommit(
        transition.profile,
        createBattleUndoEvent(transition),
      )
    : null
}

export function createBattleRedoCommit(profile: BattleProfile) {
  const transition = applyBattleRedo(profile)

  return transition
    ? createBattleProfileCommit(
        transition.profile,
        createBattleRedoEvent(transition),
      )
    : null
}

export function createDeckRevisionCommit({
  profile,
  revisedCustomValues,
}: {
  readonly profile: BattleProfile
  readonly revisedCustomValues: readonly CustomValueDefinition[]
}) {
  const transition = applyDeckRevision({
    profile,
    revisedCustomValues,
  })

  return createBattleProfileCommit(
    transition.profile,
    createDeckRevisionEvent(transition),
  )
}
