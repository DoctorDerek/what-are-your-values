import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import {
  decodeActiveDeck,
  encodeActiveDeck,
  type EncodedActiveDeck,
} from "./ActiveDeckCodec"
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
  applyDeckRevision,
  type BattleProfile,
  type BattleProfileDeckRevisionTransition,
  type BattleProfileTransition,
} from "./BattleProfile"

export const BATTLE_PROFILE_EVENT_VERSION = 1 as const

export type BattleProfileEventType =
  "battle-choice" | "battle-undo" | "battle-redo" | "deck-revision"

type BattleProfileDeltaEventType =
  "battle-choice" | "battle-undo" | "battle-redo"

type BattleProfileDeltaEvent<TEventType extends BattleProfileDeltaEventType> = {
  readonly version: typeof BATTLE_PROFILE_EVENT_VERSION
  readonly type: TEventType
  readonly delta: BattleDelta
}

type BattleProfileDeckRevisionEvent = {
  readonly version: typeof BATTLE_PROFILE_EVENT_VERSION
  readonly type: "deck-revision"
  readonly activeDeck: ActiveDeck
}

export type BattleProfileEvent =
  | BattleProfileDeltaEvent<"battle-choice">
  | BattleProfileDeltaEvent<"battle-undo">
  | BattleProfileDeltaEvent<"battle-redo">
  | BattleProfileDeckRevisionEvent

export type EncodedBattleProfileEvent = readonly [
  version: number,
  type: string,
  payload: EncodedBattleDelta | EncodedActiveDeck,
]

function createBattleProfileEvent(
  type: BattleProfileDeltaEventType,
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

export function createDeckRevisionEvent(
  transition: BattleProfileDeckRevisionTransition,
) {
  return Object.freeze({
    version: BATTLE_PROFILE_EVENT_VERSION,
    type: "deck-revision",
    activeDeck: transition.activeDeck,
  }) satisfies BattleProfileDeckRevisionEvent
}

export function encodeBattleProfileEvent(
  event: BattleProfileEvent,
): EncodedBattleProfileEvent {
  if (event.type === "deck-revision") {
    return [event.version, event.type, encodeActiveDeck(event.activeDeck)]
  }

  return [event.version, event.type, encodeBattleDelta(event.delta)]
}

function readBattleProfileEventType(value: unknown) {
  if (
    value !== "battle-choice" &&
    value !== "battle-undo" &&
    value !== "battle-redo" &&
    value !== "deck-revision"
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

  const type = readBattleProfileEventType(value[1])
  const event: BattleProfileEvent =
    type === "deck-revision"
      ? Object.freeze({
          version: BATTLE_PROFILE_EVENT_VERSION,
          type,
          activeDeck: decodeActiveDeck(value[2]),
        })
      : Object.freeze({
          version: BATTLE_PROFILE_EVENT_VERSION,
          type,
          delta: decodeBattleDelta(activeDeck, value[2]),
        })

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
  if (event.type === "deck-revision") {
    throw new Error("Event type is not a battle delta: deck-revision")
  }

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

function assertReplayedDeckRevision(
  transition: BattleProfileDeckRevisionTransition,
  event: BattleProfileEvent,
) {
  if (event.type !== "deck-revision") {
    throw new Error(`Event type is not deck-revision: ${event.type}`)
  }
  if (
    JSON.stringify(encodeActiveDeck(transition.activeDeck)) !==
    JSON.stringify(encodeActiveDeck(event.activeDeck))
  ) {
    throw new Error(
      "Persisted deck-revision event does not match its deterministic transition",
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

  if (event.type === "deck-revision") {
    return assertReplayedDeckRevision(
      applyDeckRevision({
        profile,
        revisedCustomValues: event.activeDeck.customValues,
      }),
      event,
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
