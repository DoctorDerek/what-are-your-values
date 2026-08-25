import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import {
  getValueDisplayName,
  type ActiveValueDefinition,
  type ValueId,
  type ValuePair,
} from "@game/data/src/Value"
import type { ValueProgressById } from "@game/data/src/ValueProgress"
import type { ValueChoicePosition } from "./PlayerSettingsPresentation"

export const BATTLE_ACCESSIBILITY_ACTION_KINDS = Object.freeze([
  "selection",
  "undo",
  "redo",
] as const)

export type BattleAccessibilityActionKind =
  (typeof BATTLE_ACCESSIBILITY_ACTION_KINDS)[number]

export type BattleAccessibilityAction =
  | Readonly<{
      kind: "selection"
      selectedValueId: ValueId
    }>
  | Readonly<{
      kind: "undo" | "redo"
    }>

export type PendingBattleAccessibilityAction =
  | Readonly<{
      kind: "selection"
      selectedValueId: ValueId
      priorSelectedTotalXp: number
    }>
  | Readonly<{
      kind: "undo" | "redo"
      priorTotalXpById: ReadonlyMap<ValueId, number>
    }>

export function getValueChoiceAccessibilityLabel({
  position,
  value,
  level,
}: {
  readonly position: ValueChoicePosition
  readonly value: ActiveValueDefinition
  readonly level: number
}) {
  const positionLabel = position === "first" ? "First" : "Second"

  return `Choose ${getValueDisplayName(value)}. Level ${level}. ${positionLabel} choice.`
}

export function createPendingBattleAccessibilityAction({
  action,
  progressById,
}: {
  readonly action: BattleAccessibilityAction
  readonly progressById: ValueProgressById
}): PendingBattleAccessibilityAction {
  if (action.kind === "selection") {
    const selectedProgress = progressById.get(action.selectedValueId)
    if (!selectedProgress) {
      throw new Error(
        `Selected value progress is unavailable: ${action.selectedValueId}`,
      )
    }

    return Object.freeze({
      kind: action.kind,
      selectedValueId: action.selectedValueId,
      priorSelectedTotalXp: selectedProgress.totalXp,
    })
  }

  return Object.freeze({
    kind: action.kind,
    priorTotalXpById: new Map(
      Array.from(progressById, ([valueId, { totalXp }]) => [valueId, totalXp]),
    ),
  })
}

function getActiveValueDisplayName(activeDeck: ActiveDeck, valueId: ValueId) {
  const value = activeDeck.values.find((candidate) => candidate.id === valueId)
  if (!value) throw new Error(`Active Value is unavailable: ${valueId}`)

  return getValueDisplayName(value)
}

function getCompletedXpChange({
  pendingAction,
  activeDeck,
  progressById,
}: {
  readonly pendingAction: PendingBattleAccessibilityAction
  readonly activeDeck: ActiveDeck
  readonly progressById: ValueProgressById
}) {
  if (pendingAction.kind === "selection") {
    const resultingProgress = progressById.get(pendingAction.selectedValueId)
    if (!resultingProgress) {
      throw new Error(
        `Selected value progress is unavailable: ${pendingAction.selectedValueId}`,
      )
    }

    const xpChange =
      resultingProgress.totalXp - pendingAction.priorSelectedTotalXp
    if (xpChange === 0) return null
    if (xpChange < 0) {
      throw new Error(`Invalid selection XP direction: ${xpChange}`)
    }

    return Object.freeze({
      valueId: pendingAction.selectedValueId,
      xpChange,
    })
  }

  if (
    pendingAction.priorTotalXpById.size !== activeDeck.valueIds.length ||
    progressById.size !== activeDeck.valueIds.length
  ) {
    throw new Error(
      "Battle accessibility progress does not cover the Active Deck",
    )
  }

  const xpChanges = activeDeck.valueIds.flatMap((valueId) => {
    const priorTotalXp = pendingAction.priorTotalXpById.get(valueId)
    const resultingProgress = progressById.get(valueId)
    if (priorTotalXp === undefined || !resultingProgress) {
      throw new Error(`Battle accessibility progress is missing: ${valueId}`)
    }

    const xpChange = resultingProgress.totalXp - priorTotalXp
    return xpChange === 0 ? [] : [Object.freeze({ valueId, xpChange })]
  })

  if (xpChanges.length === 0) return null
  if (xpChanges.length > 1) {
    throw new Error(
      `Battle accessibility expected one XP change but received ${xpChanges.length}`,
    )
  }

  const [xpChange] = xpChanges
  if (
    pendingAction.kind === "undo"
      ? xpChange.xpChange >= 0
      : xpChange.xpChange <= 0
  ) {
    throw new Error(
      `Invalid ${pendingAction.kind} XP direction: ${xpChange.xpChange}`,
    )
  }

  return xpChange
}

export function getBattleAccessibilityAnnouncement({
  pendingAction,
  activeDeck,
  progressById,
  pair,
}: {
  readonly pendingAction: PendingBattleAccessibilityAction
  readonly activeDeck: ActiveDeck
  readonly progressById: ValueProgressById
  readonly pair: ValuePair
}) {
  const completedXpChange = getCompletedXpChange({
    pendingAction,
    activeDeck,
    progressById,
  })
  if (!completedXpChange) return null

  const { valueId, xpChange } = completedXpChange
  const changedValueName = getActiveValueDisplayName(activeDeck, valueId)
  const comparison = `${getActiveValueDisplayName(activeDeck, pair[0])} or ${getActiveValueDisplayName(activeDeck, pair[1])}`
  const absoluteXpChange = Math.abs(xpChange)

  if (pendingAction.kind === "selection") {
    return `${changedValueName} chosen. ${absoluteXpChange} XP earned. Next: ${comparison}.`
  }
  if (pendingAction.kind === "undo") {
    return `Undo complete. ${absoluteXpChange} XP removed from ${changedValueName}. Restored: ${comparison}.`
  }

  return `Redo complete. ${absoluteXpChange} XP restored to ${changedValueName}. Next: ${comparison}.`
}
