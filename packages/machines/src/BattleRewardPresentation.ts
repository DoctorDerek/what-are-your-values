import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import type { ValueProgressById } from "@game/data/src/ValueProgress"
import { getLevelProgressFromXP } from "@game/utils/src/LevelMath"
import {
  getCompletedBattleXpChange,
  type PendingBattleAccessibilityAction,
} from "./BattleAccessibilityPresentation"

export type BattleRewardPresentation = Readonly<{
  valueId: ValueId
  label: string
  progressLabel: string
  progressPercentage: number
}>

export function getBattleRewardPresentation({
  pendingAction,
  activeDeck,
  progressById,
}: {
  readonly pendingAction: PendingBattleAccessibilityAction | null
  readonly activeDeck: ActiveDeck
  readonly progressById: ValueProgressById
}): BattleRewardPresentation | null {
  if (pendingAction?.kind !== "selection") return null
  const change = getCompletedBattleXpChange({
    pendingAction,
    activeDeck,
    progressById,
  })
  if (!change) return null
  const progress = progressById.get(change.valueId)
  if (!progress)
    throw new Error("Committed battle reward is missing value progress")
  const { level, earnedXpTowardNextLevel, requiredXpForNextLevel } =
    getLevelProgressFromXP(progress.totalXp)
  return Object.freeze({
    valueId: change.valueId,
    label: `+${change.xpChange} XP · Level ${level}`,
    progressLabel: `${earnedXpTowardNextLevel}/${requiredXpForNextLevel} XP toward Level ${level + 1}`,
    progressPercentage:
      (earnedXpTowardNextLevel / requiredXpForNextLevel) * 100,
  })
}
