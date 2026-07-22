import { describe, expect, it } from "vitest"
import { encodeBattleDelta } from "./BattleDeltaCodec"
import {
  applyBattleChoice,
  applyBattleRedo,
  applyBattleUndo,
  createInitialBattleProfile,
} from "./BattleProfile"
import {
  createBattleChoiceEvent,
  createBattleRedoEvent,
  createBattleUndoEvent,
  decodeBattleProfileEvent,
  encodeBattleProfileEvent,
  replayBattleProfileEvent,
} from "./BattleProfileEvent"
import { projectScheduledPair } from "./PairScheduler"

function chooseFirstValue(
  profile: ReturnType<typeof createInitialBattleProfile>,
) {
  const [winnerId] = projectScheduledPair(
    profile.activeDeck,
    profile.scheduler,
  ).pair

  return applyBattleChoice({
    profile,
    winnerId,
    expectedScheduler: profile.scheduler,
  })
}

describe("Battle Profile Event", () => {
  it("replays choice, Undo, and Redo into the exact canonical profile", () => {
    const initial = createInitialBattleProfile("profile-event-replay-seed")
    const firstChoice = chooseFirstValue(initial)
    const secondChoice = chooseFirstValue(firstChoice.profile)
    const undo = applyBattleUndo(secondChoice.profile)
    if (!undo) {
      throw new Error("The second choice cannot be undone")
    }
    const redo = applyBattleRedo(undo.profile)
    if (!redo) {
      throw new Error("The second choice cannot be redone")
    }
    const events = [
      createBattleChoiceEvent(firstChoice),
      createBattleChoiceEvent(secondChoice),
      createBattleUndoEvent(undo),
      createBattleRedoEvent(redo),
    ]

    const replayed = events.reduce(
      (profile, event) => replayBattleProfileEvent(profile, event),
      initial,
    )

    expect(replayed).toEqual(redo.profile)
    expect(replayed.history).toEqual(redo.profile.history)
    expect(replayed.redo).toEqual([])
  })

  it("round-trips the versioned canonical journal-event encoding", () => {
    const initial = createInitialBattleProfile("profile-event-codec-seed")
    const event = createBattleChoiceEvent(chooseFirstValue(initial))
    const encoded = encodeBattleProfileEvent(event)
    const decoded = decodeBattleProfileEvent(initial.activeDeck, encoded)

    expect(encodeBattleProfileEvent(decoded)).toEqual(encoded)
    expect(decoded).toEqual(event)
  })

  it("rejects a self-consistent payout that deterministic replay disproves", () => {
    const initial = createInitialBattleProfile("profile-event-payout-seed")
    const event = createBattleChoiceEvent(chooseFirstValue(initial))
    const encodedDelta = encodeBattleDelta(event.delta)
    const tamperedResultingWinnerProgress = [
      encodedDelta[11][0] + 1,
      encodedDelta[11][1],
      encodedDelta[11][2],
      encodedDelta[11][3],
    ]
    const tamperedDelta = [
      ...encodedDelta.slice(0, 9),
      encodedDelta[9] + 1,
      encodedDelta[10],
      tamperedResultingWinnerProgress,
      ...encodedDelta.slice(12),
    ]
    const tamperedEvent = decodeBattleProfileEvent(initial.activeDeck, [
      event.version,
      event.type,
      tamperedDelta,
    ])

    expect(() => replayBattleProfileEvent(initial, tamperedEvent)).toThrow(
      "does not match its deterministic transition",
    )
  })

  it("rejects unsupported event versions, types, and unavailable operations", () => {
    const initial = createInitialBattleProfile("profile-event-invalid-seed")
    const choice = createBattleChoiceEvent(chooseFirstValue(initial))
    const encoded = encodeBattleProfileEvent(choice)

    expect(() =>
      decodeBattleProfileEvent(initial.activeDeck, [2, encoded[1], encoded[2]]),
    ).toThrow("Unsupported Battle Profile event version")
    expect(() =>
      decodeBattleProfileEvent(initial.activeDeck, [
        encoded[0],
        "battle-reset",
        encoded[2],
      ]),
    ).toThrow("Unsupported Battle Profile event type")

    const undo = applyBattleUndo(chooseFirstValue(initial).profile)
    if (!undo) {
      throw new Error("The choice cannot be undone")
    }
    expect(() =>
      replayBattleProfileEvent(initial, createBattleUndoEvent(undo)),
    ).toThrow("Persisted battle-undo event is unavailable")
  })
})
