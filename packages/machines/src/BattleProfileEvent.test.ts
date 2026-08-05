import {
  createCustomValueId,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import { XP_QUANTUM } from "@game/utils/src/LevelMath"
import { describe, expect, it } from "vitest"
import { encodeBattleDelta } from "./BattleDeltaCodec"
import {
  applyBattleChoice,
  applyBattleRedo,
  applyBattleUndo,
  createInitialBattleProfile,
} from "./BattleProfile"
import { createDeckRevisionCommit } from "./BattleProfileCommit"
import {
  createBattleChoiceEvent,
  createBattleRedoEvent,
  createBattleUndoEvent,
  decodeBattleProfileEvent,
  encodeBattleProfileEvent,
  replayBattleProfileEvent,
  type BattleProfileEvent,
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

function createCustomValue() {
  return Object.freeze({
    kind: "custom",
    id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
    name: "Ingenuity",
    definition: "A custom value for experimentation.",
    creationOrdinal: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }) satisfies CustomValueDefinition
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

  it("round-trips deck-revision events with deterministic replay", () => {
    const initial = createInitialBattleProfile("profile-event-revision-seed")
    const revision = createDeckRevisionCommit({
      profile: initial,
      revisedCustomValues: [createCustomValue()],
    })
    const encoded = encodeBattleProfileEvent(revision.event)
    const decoded = decodeBattleProfileEvent(initial.activeDeck, encoded)

    expect(encodeBattleProfileEvent(decoded)).toEqual(encoded)
    expect(decoded.type).toBe("deck-revision")
    expect(replayBattleProfileEvent(initial, decoded)).toEqual(revision.profile)
  })

  it("preserves existing value progress when adding a custom value", () => {
    const initial = createInitialBattleProfile(
      "profile-event-revision-progress-seed",
    )
    const choice = chooseFirstValue(initial)
    const secondChoice = chooseFirstValue(choice.profile)
    const beforeRevision = secondChoice.profile
    const custom = createCustomValue()
    const revision = createDeckRevisionCommit({
      profile: beforeRevision,
      revisedCustomValues: [...beforeRevision.activeDeck.customValues, custom],
    })

    const revisionProfile = revision.profile
    for (const valueId of beforeRevision.activeDeck.valueIds) {
      const before = beforeRevision.progressById.get(valueId)
      const after = revisionProfile.progressById.get(valueId)
      if (!before || !after) {
        throw new Error(`Missing profile progress for value ${valueId}`)
      }
      expect(after.totalXp).toEqual(before.totalXp)
      expect(after.profileWins).toEqual(before.profileWins)
      expect(after.profileComparisons).toEqual(before.profileComparisons)
      expect(after.currentCycleWins).toEqual(0)
    }

    expect(revisionProfile.progressById.get(custom.id)).toMatchObject({
      totalXp: 0,
      profileComparisons: 0,
    })
    expect(revision.event.type).toBe("deck-revision")
  })

  it("rejects a self-consistent payout that deterministic replay disproves", () => {
    const initial = createInitialBattleProfile("profile-event-payout-seed")
    const event = createBattleChoiceEvent(chooseFirstValue(initial))
    const encodedDelta = encodeBattleDelta(event.delta)
    const tamperedResultingWinnerProgress = [
      encodedDelta[11][0] + XP_QUANTUM,
      encodedDelta[11][1],
      encodedDelta[11][2],
      encodedDelta[11][3],
    ]
    const tamperedDelta = [
      ...encodedDelta.slice(0, 9),
      encodedDelta[9] + XP_QUANTUM,
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

  it("rejects malformed event tuples and unsupported replay versions", () => {
    const initial = createInitialBattleProfile("profile-event-shape-seed")
    const event = createBattleChoiceEvent(chooseFirstValue(initial))

    expect(() => decodeBattleProfileEvent(initial.activeDeck, null)).toThrow(
      "Invalid Battle Profile event",
    )
    expect(() =>
      decodeBattleProfileEvent(initial.activeDeck, [event.version, event.type]),
    ).toThrow("Invalid Battle Profile event")

    const unsupportedVersion = {
      ...event,
      version: 2,
    } as BattleProfileEvent
    expect(() => replayBattleProfileEvent(initial, unsupportedVersion)).toThrow(
      "Unsupported Battle Profile event version",
    )
  })
})
