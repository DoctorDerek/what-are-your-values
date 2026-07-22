import { describe, expect, it } from "vitest"
import {
  applyBattleChoice,
  applyBattleRedo,
  applyBattleUndo,
  createInitialBattleProfile,
} from "./BattleProfile"
import { projectScheduledPair } from "./PairScheduler"

function chooseValue(
  profile: ReturnType<typeof createInitialBattleProfile>,
  pairIndex: 0 | 1,
) {
  const pair = projectScheduledPair(profile.activeDeck, profile.scheduler).pair

  return applyBattleChoice({
    profile,
    winnerId: pair[pairIndex],
    expectedScheduler: profile.scheduler,
  })
}

describe("Battle Profile", () => {
  it("commits one battle and retains its exact reversible delta", () => {
    const profile = createInitialBattleProfile("profile-choice-seed")
    const transition = chooseValue(profile, 0)

    expect(transition.profile.history).toEqual([transition.delta])
    expect(transition.profile.redo).toEqual([])
    expect(transition.profile.scheduler.cursor).toBe(1)
    expect(transition.profile.progressById.get(transition.delta.winnerId)).toBe(
      transition.delta.resultingWinnerProgress,
    )
    expect(transition.profile.progressById.get(transition.delta.loserId)).toBe(
      transition.delta.resultingLoserProgress,
    )
  })

  it("restores and reapplies the exact profile state through Undo and Redo", () => {
    const initial = createInitialBattleProfile("profile-undo-redo-seed")
    const committed = chooseValue(initial, 0)
    const undone = applyBattleUndo(committed.profile)
    if (!undone) {
      throw new Error("The committed battle cannot be undone")
    }

    expect(undone.profile.scheduler).toEqual(initial.scheduler)
    expect(undone.profile.progressById).toEqual(initial.progressById)
    expect(undone.profile.cycleLevelSnapshot).toEqual(
      initial.cycleLevelSnapshot,
    )
    expect(undone.profile.history).toEqual([])
    expect(undone.profile.redo).toEqual([committed.delta])

    const redone = applyBattleRedo(undone.profile)
    if (!redone) {
      throw new Error("The undone battle cannot be redone")
    }

    expect(redone.delta).toBe(committed.delta)
    expect(redone.profile.scheduler).toEqual(committed.profile.scheduler)
    expect(redone.profile.progressById).toEqual(committed.profile.progressById)
    expect(redone.profile.cycleLevelSnapshot).toEqual(
      committed.profile.cycleLevelSnapshot,
    )
    expect(redone.profile.history).toEqual([committed.delta])
    expect(redone.profile.redo).toEqual([])
  })

  it("clears Redo and records the replacement delta after branching", () => {
    const initial = createInitialBattleProfile("profile-branch-seed")
    const firstChoice = chooseValue(initial, 0)
    const undone = applyBattleUndo(firstChoice.profile)
    if (!undone) {
      throw new Error("The first choice cannot be undone")
    }

    const replacementChoice = chooseValue(undone.profile, 1)

    expect(replacementChoice.delta.battleId).toBe(firstChoice.delta.battleId)
    expect(replacementChoice.delta.winnerId).toBe(firstChoice.delta.loserId)
    expect(replacementChoice.profile.history).toEqual([replacementChoice.delta])
    expect(replacementChoice.profile.redo).toEqual([])
  })

  it("leaves a fresh profile unchanged when Undo or Redo is unavailable", () => {
    const profile = createInitialBattleProfile("profile-unavailable-seed")

    expect(applyBattleUndo(profile)).toBeNull()
    expect(applyBattleRedo(profile)).toBeNull()
    expect(profile.history).toEqual([])
    expect(profile.redo).toEqual([])
  })
})
