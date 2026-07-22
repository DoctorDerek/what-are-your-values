import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { BattleDelta } from "./BattleDelta"
import {
  decodeBattleDelta,
  encodeBattleDelta,
  type EncodedBattleDelta,
} from "./BattleDeltaCodec"
import {
  applyBattleChoice,
  applyBattleRedo,
  applyBattleUndo,
  type BattleProfile,
  type BattleProfileTransition,
} from "./BattleProfile"

export const BATTLE_PROFILE_EVENT_VERSION = 1 as const

export type BattleProfileEventType =
  "battle-choice" | "battle-undo" | "battle-redo"

export type BattleProfileEvent = {
  readonly version: typeof BATTLE_PROFILE_EVENT_VERSION
  readonly type: BattleProfileEventType
  readonly delta: BattleDelta
}

export type EncodedBattleProfileEvent = readonly [
  version: number,
  type: string,
  delta: EncodedBattleDelta,
]

function createBattleProfileEvent(
  type: BattleProfileEventType,
  transition: BattleProfileTransition,
) {
  return Object.freeze({
    version: BATTLE_PROFILE_EVENT_VERSION,
    type,
    delta: transition.delta,
  }) satisfies BattleProfileEvent
}

export function createBattleChoiceEvent(transition: BattleProfileTransition) {
  return createBattleProfileEvent("battle-choice", transition)
}

export function createBattleUndoEvent(transition: BattleProfileTransition) {
  return createBattleProfileEvent("battle-undo", transition)
}

export function createBattleRedoEvent(transition: BattleProfileTransition) {
  return createBattleProfileEvent("battle-redo", transition)
}

export function encodeBattleProfileEvent(
  event: BattleProfileEvent,
): EncodedBattleProfileEvent {
  return [event.version, event.type, encodeBattleDelta(event.delta)]
}

function readBattleProfileEventType(value: unknown) {
  if (
    value !== "battle-choice" &&
    value !== "battle-undo" &&
    value !== "battle-redo"
  ) {
    throw new Error(`Unsupported Battle Profile event type: ${String(value)}`)
  }

  return value
}

export function decodeBattleProfileEvent(
  activeDeck: ActiveDeck,
  value: unknown,
) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error("Invalid Battle Profile event")
  }

  if (value[0] !== BATTLE_PROFILE_EVENT_VERSION) {
    throw new Error(`Unsupported Battle Profile event version: ${value[0]}`)
  }

  const event = Object.freeze({
    version: BATTLE_PROFILE_EVENT_VERSION,
    type: readBattleProfileEventType(value[1]),
    delta: decodeBattleDelta(activeDeck, value[2]),
  }) satisfies BattleProfileEvent

  if (
    JSON.stringify(encodeBattleProfileEvent(event)) !== JSON.stringify(value)
  ) {
    throw new Error("Battle Profile event encoding is not canonical")
  }

  return event
}

function assertReplayedDelta(
  transition: BattleProfileTransition,
  event: BattleProfileEvent,
) {
  if (
    JSON.stringify(encodeBattleDelta(transition.delta)) !==
    JSON.stringify(encodeBattleDelta(event.delta))
  ) {
    throw new Error(
      "Persisted Battle Profile event does not match its deterministic transition",
    )
  }

  return transition.profile
}

export function replayBattleProfileEvent(
  profile: BattleProfile,
  event: BattleProfileEvent,
) {
  if (event.version !== BATTLE_PROFILE_EVENT_VERSION) {
    throw new Error(
      `Unsupported Battle Profile event version: ${event.version}`,
    )
  }

  if (event.type === "battle-choice") {
    return assertReplayedDelta(
      applyBattleChoice({
        profile,
        winnerId: event.delta.winnerId,
        expectedScheduler: event.delta.priorScheduler,
      }),
      event,
    )
  }

  const transition =
    event.type === "battle-undo"
      ? applyBattleUndo(profile)
      : applyBattleRedo(profile)
  if (!transition) {
    throw new Error(`Persisted ${event.type} event is unavailable`)
  }

  return assertReplayedDelta(transition, event)
}
