import { getPairCount } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import { getLevelFromXP } from "@game/utils/src/LevelMath"
import { describe, expect, it } from "vitest"
import { readAchievementId } from "./AchievementCatalog"
import {
  createAchievementState,
  createInitialAchievementState,
} from "./AchievementState"
import { applyAchievementTransition } from "./AchievementTransition"
import {
  applyBattleChoice,
  applyBattleRedo,
  applyBattleUndo,
  applyDeckRevision,
  createInitialBattleProfile,
} from "./BattleProfile"
import {
  createBattleChoiceEvent,
  createBattleRedoEvent,
  createBattleUndoEvent,
  createDeckRevisionEvent,
} from "./BattleProfileEvent"
import { projectBattlePair } from "./BattleScheduler"
import { createCustomValueAddCommit } from "./CustomValueCommands"
import { createSchedulerRestorePoint } from "./PairScheduler"

const OCCURRED_AT = "2026-07-29T00:00:00.000Z"

function chooseWinner(
  profile: ReturnType<typeof createInitialBattleProfile>,
  winnerId?: ValueId,
) {
  const pair = projectBattlePair(profile.activeDeck, profile.scheduler)
  const transition = applyBattleChoice({
    profile,
    winnerId: winnerId ?? pair[0],
    expectedScheduler: profile.scheduler,
  })

  return {
    transition,
    event: createBattleChoiceEvent(transition),
  }
}

describe("Achievement Transition", () => {
  it("unlocks and counts the first accepted battle exactly once", () => {
    const profile = createInitialBattleProfile("first-achievement-seed")
    const initialState = createInitialAchievementState(profile.activeDeck)
    const { transition, event } = chooseWinner(profile)
    const resultingState = applyAchievementTransition({
      state: initialState,
      priorProfile: profile,
      resultingProfile: transition.profile,
      event,
      occurredAt: OCCURRED_AT,
    })

    expect(resultingState.progress.lifetimeBattleCount).toBe(1)
    expect(resultingState.progress.countedBattleWindow.ids).toEqual([
      event.delta.battleId,
    ])
    expect(resultingState.unlocks).toEqual([
      expect.objectContaining({
        id: readAchievementId("battle.first", "Achievement ID"),
        unlockedAt: OCCURRED_AT,
      }),
    ])
  })

  it("does not recount Undo Redo or a replacement choice for one battle", () => {
    const profile = createInitialBattleProfile("achievement-undo-seed")
    const initialState = createInitialAchievementState(profile.activeDeck)
    const first = chooseWinner(profile)
    const afterFirst = applyAchievementTransition({
      state: initialState,
      priorProfile: profile,
      resultingProfile: first.transition.profile,
      event: first.event,
      occurredAt: OCCURRED_AT,
    })
    const undoTransition = applyBattleUndo(first.transition.profile)
    if (!undoTransition) {
      throw new Error("Undo fixture is unavailable")
    }
    const undoEvent = createBattleUndoEvent(undoTransition)
    const afterUndo = applyAchievementTransition({
      state: afterFirst,
      priorProfile: first.transition.profile,
      resultingProfile: undoTransition.profile,
      event: undoEvent,
      occurredAt: OCCURRED_AT,
    })
    const redoTransition = applyBattleRedo(undoTransition.profile)
    if (!redoTransition) {
      throw new Error("Redo fixture is unavailable")
    }
    const afterRedo = applyAchievementTransition({
      state: afterUndo,
      priorProfile: undoTransition.profile,
      resultingProfile: redoTransition.profile,
      event: createBattleRedoEvent(redoTransition),
      occurredAt: OCCURRED_AT,
    })
    const secondUndoTransition = applyBattleUndo(redoTransition.profile)
    if (!secondUndoTransition) {
      throw new Error("Second Undo fixture is unavailable")
    }
    const afterSecondUndo = applyAchievementTransition({
      state: afterRedo,
      priorProfile: redoTransition.profile,
      resultingProfile: secondUndoTransition.profile,
      event: createBattleUndoEvent(secondUndoTransition),
      occurredAt: OCCURRED_AT,
    })
    const replacementPair = projectBattlePair(
      secondUndoTransition.profile.activeDeck,
      secondUndoTransition.profile.scheduler,
    )
    const replacement = chooseWinner(
      secondUndoTransition.profile,
      replacementPair[1],
    )
    const afterReplacement = applyAchievementTransition({
      state: afterSecondUndo,
      priorProfile: secondUndoTransition.profile,
      resultingProfile: replacement.transition.profile,
      event: replacement.event,
      occurredAt: OCCURRED_AT,
    })

    expect(afterUndo.progress.lifetimeBattleCount).toBe(1)
    expect(afterRedo.progress.lifetimeBattleCount).toBe(1)
    expect(afterReplacement.progress.lifetimeBattleCount).toBe(1)
    expect(afterReplacement.unlocks).toHaveLength(1)
  })

  it("keeps cycle completion as scheduler evidence without an achievement", () => {
    const initialProfile = createInitialBattleProfile(
      "cycle-completion-achievement-seed",
    )
    const profile = Object.freeze({
      ...initialProfile,
      scheduler: createSchedulerRestorePoint({
        activeDeck: initialProfile.activeDeck,
        progressGeneration: initialProfile.scheduler.progressGeneration,
        deckRevision: initialProfile.scheduler.deckRevision,
        seed: initialProfile.scheduler.seed,
        cycleIndex: initialProfile.scheduler.cycleIndex,
        cursor: getPairCount(initialProfile.activeDeck.valueIds.length) - 1,
      }),
    })
    const completedCycle = chooseWinner(profile)
    const afterCompletion = applyAchievementTransition({
      state: createInitialAchievementState(profile.activeDeck),
      priorProfile: profile,
      resultingProfile: completedCycle.transition.profile,
      event: completedCycle.event,
      occurredAt: OCCURRED_AT,
    })
    const undoTransition = applyBattleUndo(completedCycle.transition.profile)
    if (!undoTransition) {
      throw new Error("Cycle-boundary Undo fixture is unavailable")
    }
    const afterUndo = applyAchievementTransition({
      state: afterCompletion,
      priorProfile: completedCycle.transition.profile,
      resultingProfile: undoTransition.profile,
      event: createBattleUndoEvent(undoTransition),
      occurredAt: OCCURRED_AT,
    })
    const redoTransition = applyBattleRedo(undoTransition.profile)
    if (!redoTransition) {
      throw new Error("Cycle-boundary Redo fixture is unavailable")
    }
    const afterRedo = applyAchievementTransition({
      state: afterUndo,
      priorProfile: undoTransition.profile,
      resultingProfile: redoTransition.profile,
      event: createBattleRedoEvent(redoTransition),
      occurredAt: OCCURRED_AT,
    })
    expect(completedCycle.event.delta.cycleBoundary).not.toBeNull()
    expect(afterCompletion.unlocks.map(({ id }) => id)).toEqual([
      readAchievementId("battle.first", "Achievement ID"),
    ])
    expect(afterUndo.unlocks).toEqual(afterCompletion.unlocks)
    expect(afterRedo.unlocks).toEqual(afterCompletion.unlocks)
  })

  it("unlocks literal battle-count milestones without filling gaps", () => {
    let profile = createInitialBattleProfile("ten-battle-achievement-seed")
    let state = createInitialAchievementState(profile.activeDeck)

    for (let comparison = 1; comparison <= 10; comparison += 1) {
      const { transition, event } = chooseWinner(profile)
      state = applyAchievementTransition({
        state,
        priorProfile: profile,
        resultingProfile: transition.profile,
        event,
        occurredAt: new Date(
          Date.parse(OCCURRED_AT) + comparison * 1_000,
        ).toISOString(),
      })
      profile = transition.profile
    }

    expect(state.progress.lifetimeBattleCount).toBe(10)
    expect(
      state.unlocks
        .map(({ id }) => id)
        .filter((id) => id.startsWith("battle.")),
    ).toEqual([
      readAchievementId("battle.first", "Achievement ID"),
      readAchievementId("battle.5", "Achievement ID"),
      readAchievementId("battle.10", "Achievement ID"),
    ])
  })

  it("reveals the first Top Five only after five values earn experience", () => {
    let profile = createInitialBattleProfile("top-five-achievement-seed")
    let state = createInitialAchievementState(profile.activeDeck)
    const winningValueIds = new Set<ValueId>()

    while (winningValueIds.size < 5) {
      const pair = projectBattlePair(profile.activeDeck, profile.scheduler)
      const winnerId =
        pair.find((valueId) => !winningValueIds.has(valueId)) ?? pair[0]
      const { transition, event } = chooseWinner(profile, winnerId)
      winningValueIds.add(winnerId)
      state = applyAchievementTransition({
        state,
        priorProfile: profile,
        resultingProfile: transition.profile,
        event,
        occurredAt: OCCURRED_AT,
      })
      profile = transition.profile
    }

    expect(state.unlocks.map(({ id }) => id)).toContain(
      readAchievementId("topFive.first", "Achievement ID"),
    )
  })

  it("unlocks every crossed value-level threshold once", () => {
    const profile = createInitialBattleProfile("level-achievement-seed")
    const { transition, event } = chooseWinner(profile)
    const winnerProgress = profile.progressById.get(event.delta.winnerId)
    if (!winnerProgress) {
      throw new Error("Winner progress fixture is unavailable")
    }
    const priorProgressById = new Map(profile.progressById)
    const resultingProgressById = new Map(transition.profile.progressById)
    priorProgressById.set(event.delta.winnerId, {
      ...winnerProgress,
      totalXp: 4,
      profileWins: 1,
      profileComparisons: 1,
      currentCycleWins: 1,
    })
    resultingProgressById.set(event.delta.winnerId, {
      ...winnerProgress,
      totalXp: 20,
      profileWins: 2,
      profileComparisons: 2,
      currentCycleWins: 2,
    })
    const priorProfile = { ...profile, progressById: priorProgressById }
    const resultingProfile = {
      ...transition.profile,
      progressById: resultingProgressById,
    }
    const state = createAchievementState({
      activeDeck: profile.activeDeck,
      unlocks: [],
      presentedAchievementIds: [],
      progress: {
        ...createInitialAchievementState(profile.activeDeck).progress,
        baselineLevelsByValue: new Map(
          profile.activeDeck.valueIds.map((valueId) => [valueId, 1]),
        ),
      },
    })

    expect(getLevelFromXP(4)).toBe(3)
    expect(getLevelFromXP(20)).toBe(12)
    expect(
      applyAchievementTransition({
        state,
        priorProfile,
        resultingProfile,
        event,
        occurredAt: OCCURRED_AT,
      }).unlocks.map(({ id }) => id),
    ).toEqual([
      readAchievementId("battle.first", "Achievement ID"),
      readAchievementId("valueLevel.5", "Achievement ID"),
      readAchievementId("valueLevel.10", "Achievement ID"),
    ])
  })

  it("rejects lifetime battle-count overflow before integer precision is lost", () => {
    const profile = createInitialBattleProfile("achievement-overflow-seed")
    const { transition, event } = chooseWinner(profile)
    const initialState = createInitialAchievementState(profile.activeDeck)
    const saturatedState = createAchievementState({
      activeDeck: profile.activeDeck,
      unlocks: [],
      presentedAchievementIds: [],
      progress: {
        ...initialState.progress,
        lifetimeBattleCount: Number.MAX_SAFE_INTEGER,
      },
    })

    expect(() =>
      applyAchievementTransition({
        state: saturatedState,
        priorProfile: profile,
        resultingProfile: transition.profile,
        event,
        occurredAt: OCCURRED_AT,
      }),
    ).toThrow("Achievement lifetime battle count cannot be incremented safely")
  })

  it("rebases achievement levels and replay evidence after a deck revision", () => {
    const profile = createInitialBattleProfile("achievement-deck-seed")
    const first = chooseWinner(profile)
    const state = applyAchievementTransition({
      state: createInitialAchievementState(profile.activeDeck),
      priorProfile: profile,
      resultingProfile: first.transition.profile,
      event: first.event,
      occurredAt: OCCURRED_AT,
    })
    const addCommit = createCustomValueAddCommit({
      profile: first.transition.profile,
      name: "Ingenuity",
      definition: "Finding useful new paths through difficult problems.",
      now: () => "2026-07-29T00:01:00.000Z",
      randomUuid: () => "00000000-0000-4000-8000-000000000001",
    })
    const deckTransition = applyDeckRevision({
      profile: first.transition.profile,
      revisedCustomValues: addCommit.profile.activeDeck.customValues,
    })
    const resultingState = applyAchievementTransition({
      state,
      priorProfile: first.transition.profile,
      resultingProfile: deckTransition.profile,
      event: createDeckRevisionEvent(deckTransition),
      occurredAt: OCCURRED_AT,
    })

    expect(resultingState.progress.baselineLevelsByValue).toHaveLength(
      deckTransition.profile.activeDeck.valueIds.length,
    )
    expect(
      new Set(resultingState.progress.baselineLevelsByValue.values()),
    ).toEqual(new Set([1]))
    expect(resultingState.progress.countedBattleWindow.ids).toEqual([])
    expect(resultingState.progress.lifetimeBattleCount).toBe(1)
    expect(resultingState.unlocks).toEqual(state.unlocks)
  })
})
