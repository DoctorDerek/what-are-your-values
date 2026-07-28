import { describe, expect, it } from "vitest"
import { createInitialBattleProfile } from "./BattleProfile"
import {
  createBattleChoiceCommit,
  createBattleRedoCommit,
  createBattleUndoCommit,
} from "./BattleProfileCommit"
import { replayBattleProfileEvent } from "./BattleProfileEvent"
import { projectScheduledPair } from "./PairScheduler"

describe("Battle Profile Commit", () => {
  it("couples Choice, Undo, and Redo profiles to their exact replayable events", () => {
    const initialProfile = createInitialBattleProfile("commit-event-seed")
    const [winnerId] = projectScheduledPair(
      initialProfile.activeDeck,
      initialProfile.scheduler,
    ).pair
    const choice = createBattleChoiceCommit({
      profile: initialProfile,
      winnerId,
      expectedScheduler: initialProfile.scheduler,
    })
    const undo = createBattleUndoCommit(choice.profile)
    if (!undo) {
      throw new Error("The committed battle cannot be undone")
    }
    const redo = createBattleRedoCommit(undo.profile)
    if (!redo) {
      throw new Error("The undone battle cannot be redone")
    }

    expect(replayBattleProfileEvent(initialProfile, choice.event)).toEqual(
      choice.profile,
    )
    expect(replayBattleProfileEvent(choice.profile, undo.event)).toEqual(
      undo.profile,
    )
    expect(replayBattleProfileEvent(undo.profile, redo.event)).toEqual(
      redo.profile,
    )
    expect(createBattleUndoCommit(initialProfile)).toBeNull()
    expect(createBattleRedoCommit(initialProfile)).toBeNull()
  })
})
