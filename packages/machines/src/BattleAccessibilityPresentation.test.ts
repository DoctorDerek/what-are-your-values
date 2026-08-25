import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createCanonicalValueId,
  createCustomValueId,
  getValueDisplayName,
  type CustomValueDefinition,
  type ValueId,
  type ValuePair,
} from "@game/data/src/Value"
import type { ValueProgressById } from "@game/data/src/ValueProgress"
import { describe, expect, it } from "vitest"
import {
  BATTLE_ACCESSIBILITY_ACTION_KINDS,
  createPendingBattleAccessibilityAction,
  getBattleAccessibilityAnnouncement,
  getValueChoiceAccessibilityLabel,
} from "./BattleAccessibilityPresentation"
import {
  createBattleCycleCandidate,
  createInitialBattleCycle,
} from "./BattleCycle"
import { projectBattlePair } from "./BattleScheduler"

function getActiveValue(activeDeck: ActiveDeck, valueId: ValueId) {
  const value = activeDeck.values.find((candidate) => candidate.id === valueId)
  if (!value) throw new Error(`Test value is unavailable: ${valueId}`)

  return value
}

function getActiveValueName(activeDeck: ActiveDeck, valueId: ValueId) {
  return getValueDisplayName(getActiveValue(activeDeck, valueId))
}

function replaceTotalXp(
  progressById: ValueProgressById,
  valueId: ValueId,
  totalXp: number,
) {
  const progress = progressById.get(valueId)
  if (!progress) throw new Error(`Test progress is unavailable: ${valueId}`)

  const revisedProgressById = new Map(progressById)
  revisedProgressById.set(valueId, Object.freeze({ ...progress, totalXp }))
  return revisedProgressById
}

function createCompletedBattleFixture() {
  const initialBattleCycle = createInitialBattleCycle(
    "battle-accessibility-presentation",
  )
  const initialPair = projectBattlePair(
    initialBattleCycle.activeDeck,
    initialBattleCycle.scheduler,
  )
  const winnerId = initialPair[0]
  const resultingBattleCycle = createBattleCycleCandidate({
    battleCycle: initialBattleCycle,
    winnerId,
    expectedScheduler: initialBattleCycle.scheduler,
  })
  const resultingPair = projectBattlePair(
    resultingBattleCycle.activeDeck,
    resultingBattleCycle.scheduler,
  )

  return {
    initialBattleCycle,
    initialPair,
    winnerId,
    resultingBattleCycle,
    resultingPair,
  }
}

describe("Battle accessibility presentation", () => {
  it("owns the frozen action catalog and complete choice labels", () => {
    const { initialBattleCycle, initialPair } = createCompletedBattleFixture()
    const firstValue = getActiveValue(
      initialBattleCycle.activeDeck,
      initialPair[0],
    )
    const secondValue = getActiveValue(
      initialBattleCycle.activeDeck,
      initialPair[1],
    )
    const customValue = Object.freeze({
      kind: "custom",
      id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
      name: "Ingenuity",
      definition: "Finding an original way through a real constraint.",
      creationOrdinal: 1,
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    }) satisfies CustomValueDefinition

    expect(BATTLE_ACCESSIBILITY_ACTION_KINDS).toEqual([
      "selection",
      "undo",
      "redo",
    ])
    expect(Object.isFrozen(BATTLE_ACCESSIBILITY_ACTION_KINDS)).toBe(true)
    expect(
      getValueChoiceAccessibilityLabel({
        position: "first",
        value: firstValue,
        level: 4,
      }),
    ).toBe(`First choice: Choose ${getValueDisplayName(firstValue)}. Level 4.`)
    expect(
      getValueChoiceAccessibilityLabel({
        position: "second",
        value: secondValue,
        level: 1,
      }),
    ).toBe(
      `Second choice: Choose ${getValueDisplayName(secondValue)}. Level 1.`,
    )
    expect(
      getValueChoiceAccessibilityLabel({
        position: "second",
        value: customValue,
        level: 7,
      }),
    ).toBe("Second choice: Choose Ingenuity. Level 7.")
  })

  it("preserves one selection scalar and a complete history XP snapshot", () => {
    const { initialBattleCycle, winnerId } = createCompletedBattleFixture()
    const selection = createPendingBattleAccessibilityAction({
      action: { kind: "selection", selectedValueId: winnerId },
      progressById: initialBattleCycle.progressById,
    })
    const undo = createPendingBattleAccessibilityAction({
      action: { kind: "undo" },
      progressById: initialBattleCycle.progressById,
    })

    expect(selection).toEqual({
      kind: "selection",
      selectedValueId: winnerId,
      priorSelectedTotalXp: 0,
    })
    expect(selection).not.toHaveProperty("priorTotalXpById")
    expect(Object.isFrozen(selection)).toBe(true)
    expect(undo.kind).toBe("undo")
    if (undo.kind === "selection") throw new Error("Expected Undo snapshot")
    expect(undo.priorTotalXpById).toEqual(
      new Map(
        Array.from(
          initialBattleCycle.progressById,
          ([valueId, { totalXp }]) => [valueId, totalXp],
        ),
      ),
    )
    expect(Object.isFrozen(undo)).toBe(true)
  })

  it("announces a durable selection with exact XP and the next comparison", () => {
    const {
      initialBattleCycle,
      winnerId,
      resultingBattleCycle,
      resultingPair,
    } = createCompletedBattleFixture()
    const pendingAction = createPendingBattleAccessibilityAction({
      action: { kind: "selection", selectedValueId: winnerId },
      progressById: initialBattleCycle.progressById,
    })
    const nextComparison = `${getActiveValueName(resultingBattleCycle.activeDeck, resultingPair[0])} or ${getActiveValueName(resultingBattleCycle.activeDeck, resultingPair[1])}`

    expect(
      getBattleAccessibilityAnnouncement({
        pendingAction,
        activeDeck: resultingBattleCycle.activeDeck,
        progressById: resultingBattleCycle.progressById,
        pair: resultingPair,
      }),
    ).toBe(
      `${getActiveValueName(resultingBattleCycle.activeDeck, winnerId)} selected. ${resultingBattleCycle.delta.xpGained} XP earned. Next comparison: ${nextComparison}.`,
    )
  })

  it("announces Undo and Redo with exact XP and pair orientation", () => {
    const {
      initialBattleCycle,
      initialPair,
      winnerId,
      resultingBattleCycle,
      resultingPair,
    } = createCompletedBattleFixture()
    const undo = createPendingBattleAccessibilityAction({
      action: { kind: "undo" },
      progressById: resultingBattleCycle.progressById,
    })
    const redo = createPendingBattleAccessibilityAction({
      action: { kind: "redo" },
      progressById: initialBattleCycle.progressById,
    })
    const winnerName = getActiveValueName(
      initialBattleCycle.activeDeck,
      winnerId,
    )
    const restoredComparison = `${getActiveValueName(initialBattleCycle.activeDeck, initialPair[0])} or ${getActiveValueName(initialBattleCycle.activeDeck, initialPair[1])}`
    const nextComparison = `${getActiveValueName(resultingBattleCycle.activeDeck, resultingPair[0])} or ${getActiveValueName(resultingBattleCycle.activeDeck, resultingPair[1])}`

    expect(
      getBattleAccessibilityAnnouncement({
        pendingAction: undo,
        activeDeck: initialBattleCycle.activeDeck,
        progressById: initialBattleCycle.progressById,
        pair: initialPair,
      }),
    ).toBe(
      `Undo complete. ${resultingBattleCycle.delta.xpGained} XP reversed for ${winnerName}. Restored comparison: ${restoredComparison}.`,
    )
    expect(
      getBattleAccessibilityAnnouncement({
        pendingAction: redo,
        activeDeck: resultingBattleCycle.activeDeck,
        progressById: resultingBattleCycle.progressById,
        pair: resultingPair,
      }),
    ).toBe(
      `Redo complete. ${resultingBattleCycle.delta.xpGained} XP restored to ${winnerName}. Next comparison: ${nextComparison}.`,
    )
  })

  it("waits until selection and history XP changes are observable", () => {
    const { initialBattleCycle, winnerId } = createCompletedBattleFixture()
    const selection = createPendingBattleAccessibilityAction({
      action: { kind: "selection", selectedValueId: winnerId },
      progressById: initialBattleCycle.progressById,
    })
    const undo = createPendingBattleAccessibilityAction({
      action: { kind: "undo" },
      progressById: initialBattleCycle.progressById,
    })

    expect(
      getBattleAccessibilityAnnouncement({
        pendingAction: selection,
        activeDeck: initialBattleCycle.activeDeck,
        progressById: initialBattleCycle.progressById,
        pair: projectBattlePair(
          initialBattleCycle.activeDeck,
          initialBattleCycle.scheduler,
        ),
      }),
    ).toBeNull()
    expect(
      getBattleAccessibilityAnnouncement({
        pendingAction: undo,
        activeDeck: initialBattleCycle.activeDeck,
        progressById: initialBattleCycle.progressById,
        pair: projectBattlePair(
          initialBattleCycle.activeDeck,
          initialBattleCycle.scheduler,
        ),
      }),
    ).toBeNull()
  })

  it("rejects missing selection progress and a reversed selection delta", () => {
    const {
      initialBattleCycle,
      winnerId,
      resultingBattleCycle,
      resultingPair,
    } = createCompletedBattleFixture()
    const missingWinnerProgress = new Map(initialBattleCycle.progressById)
    missingWinnerProgress.delete(winnerId)

    expect(() =>
      createPendingBattleAccessibilityAction({
        action: { kind: "selection", selectedValueId: winnerId },
        progressById: missingWinnerProgress,
      }),
    ).toThrow(`Selected value progress is unavailable: ${winnerId}`)

    const pendingSelection = createPendingBattleAccessibilityAction({
      action: { kind: "selection", selectedValueId: winnerId },
      progressById: initialBattleCycle.progressById,
    })
    expect(() =>
      getBattleAccessibilityAnnouncement({
        pendingAction: pendingSelection,
        activeDeck: initialBattleCycle.activeDeck,
        progressById: missingWinnerProgress,
        pair: resultingPair,
      }),
    ).toThrow(`Selected value progress is unavailable: ${winnerId}`)

    const selectionAfterWin = createPendingBattleAccessibilityAction({
      action: { kind: "selection", selectedValueId: winnerId },
      progressById: resultingBattleCycle.progressById,
    })
    expect(() =>
      getBattleAccessibilityAnnouncement({
        pendingAction: selectionAfterWin,
        activeDeck: initialBattleCycle.activeDeck,
        progressById: initialBattleCycle.progressById,
        pair: resultingPair,
      }),
    ).toThrow(`Invalid selection XP direction`)
  })

  it("rejects incomplete or internally missing history progress", () => {
    const { initialBattleCycle } = createCompletedBattleFixture()
    const [missingValueId] = initialBattleCycle.activeDeck.valueIds
    const incompleteProgress = new Map(initialBattleCycle.progressById)
    incompleteProgress.delete(missingValueId)
    const incompletePriorAction = createPendingBattleAccessibilityAction({
      action: { kind: "undo" },
      progressById: incompleteProgress,
    })
    const completePriorAction = createPendingBattleAccessibilityAction({
      action: { kind: "undo" },
      progressById: initialBattleCycle.progressById,
    })
    const pair = projectBattlePair(
      initialBattleCycle.activeDeck,
      initialBattleCycle.scheduler,
    )

    expect(() =>
      getBattleAccessibilityAnnouncement({
        pendingAction: incompletePriorAction,
        activeDeck: initialBattleCycle.activeDeck,
        progressById: initialBattleCycle.progressById,
        pair,
      }),
    ).toThrow("Battle accessibility progress does not cover the Active Deck")
    expect(() =>
      getBattleAccessibilityAnnouncement({
        pendingAction: completePriorAction,
        activeDeck: initialBattleCycle.activeDeck,
        progressById: incompleteProgress,
        pair,
      }),
    ).toThrow("Battle accessibility progress does not cover the Active Deck")

    const equalSizeProgressWithMissingValue = new Map(
      initialBattleCycle.progressById,
    )
    const missingProgress =
      equalSizeProgressWithMissingValue.get(missingValueId)
    if (!missingProgress) throw new Error("Expected test progress")
    equalSizeProgressWithMissingValue.delete(missingValueId)
    equalSizeProgressWithMissingValue.set(
      createCanonicalValueId("pvcs-2011:not-active"),
      missingProgress,
    )
    expect(() =>
      getBattleAccessibilityAnnouncement({
        pendingAction: completePriorAction,
        activeDeck: initialBattleCycle.activeDeck,
        progressById: equalSizeProgressWithMissingValue,
        pair,
      }),
    ).toThrow(`Battle accessibility progress is missing: ${missingValueId}`)
  })

  it("rejects multiple history changes and the wrong history direction", () => {
    const {
      initialBattleCycle,
      initialPair,
      resultingBattleCycle,
      resultingPair,
    } = createCompletedBattleFixture()
    const [firstValueId, secondValueId] = initialBattleCycle.activeDeck.valueIds
    const firstProgressChange = replaceTotalXp(
      initialBattleCycle.progressById,
      firstValueId,
      4,
    )
    const twoProgressChanges = replaceTotalXp(
      firstProgressChange,
      secondValueId,
      4,
    )
    const multipleUndo = createPendingBattleAccessibilityAction({
      action: { kind: "undo" },
      progressById: twoProgressChanges,
    })
    const positiveUndo = createPendingBattleAccessibilityAction({
      action: { kind: "undo" },
      progressById: initialBattleCycle.progressById,
    })
    const negativeRedo = createPendingBattleAccessibilityAction({
      action: { kind: "redo" },
      progressById: resultingBattleCycle.progressById,
    })

    expect(() =>
      getBattleAccessibilityAnnouncement({
        pendingAction: multipleUndo,
        activeDeck: initialBattleCycle.activeDeck,
        progressById: initialBattleCycle.progressById,
        pair: initialPair,
      }),
    ).toThrow("Battle accessibility expected one XP change but received 2")
    expect(() =>
      getBattleAccessibilityAnnouncement({
        pendingAction: positiveUndo,
        activeDeck: resultingBattleCycle.activeDeck,
        progressById: resultingBattleCycle.progressById,
        pair: resultingPair,
      }),
    ).toThrow("Invalid undo XP direction")
    expect(() =>
      getBattleAccessibilityAnnouncement({
        pendingAction: negativeRedo,
        activeDeck: initialBattleCycle.activeDeck,
        progressById: initialBattleCycle.progressById,
        pair: initialPair,
      }),
    ).toThrow("Invalid redo XP direction")
  })

  it("rejects a comparison containing an inactive value", () => {
    const {
      initialBattleCycle,
      winnerId,
      resultingBattleCycle,
      resultingPair,
    } = createCompletedBattleFixture()
    const pendingAction = createPendingBattleAccessibilityAction({
      action: { kind: "selection", selectedValueId: winnerId },
      progressById: initialBattleCycle.progressById,
    })
    const inactiveValueId = createCanonicalValueId("pvcs-2011:not-active")
    const inactivePair = Object.freeze([
      resultingPair[0],
      inactiveValueId,
    ]) as ValuePair

    expect(() =>
      getBattleAccessibilityAnnouncement({
        pendingAction,
        activeDeck: resultingBattleCycle.activeDeck,
        progressById: resultingBattleCycle.progressById,
        pair: inactivePair,
      }),
    ).toThrow(`Active Value is unavailable: ${inactiveValueId}`)
  })
})
