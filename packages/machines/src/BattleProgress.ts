import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId, ValuePair } from "@game/data/src/Value"
import {
  createValueProgressById,
  type ValueProgress,
  type ValueProgressById,
} from "@game/data/src/ValueProgress"
import {
  calculateCycleSnapshotXpPayout,
  MAX_SUPPORTED_TOTAL_XP,
} from "@game/utils/src/LevelMath"
import {
  validateCycleLevelSnapshot,
  type CycleLevelSnapshot,
} from "./CycleLevelSnapshot"

export type BattleProgressDelta = {
  readonly pair: ValuePair
  readonly winnerId: ValueId
  readonly loserId: ValueId
  readonly xpGained: number
  readonly priorWinnerProgress: ValueProgress
  readonly resultingWinnerProgress: ValueProgress
  readonly priorLoserProgress: ValueProgress
  readonly resultingLoserProgress: ValueProgress
}

export type BattleProgressCandidate = {
  readonly progressById: ValueProgressById
  readonly delta: BattleProgressDelta
}

function incrementCounter(value: number, label: string) {
  if (value === Number.MAX_SAFE_INTEGER) {
    throw new Error(`${label} cannot be incremented safely`)
  }

  return value + 1
}

function addXp(totalXp: number, xpGained: number) {
  if (totalXp > MAX_SUPPORTED_TOTAL_XP - xpGained) {
    throw new Error("Total XP cannot be incremented safely")
  }

  return totalXp + xpGained
}

function validateBattlePair(
  activeDeck: ActiveDeck,
  pair: ValuePair,
  winnerId: ValueId,
) {
  const [firstValueId, secondValueId] = pair
  if (firstValueId === secondValueId) {
    throw new Error("Battle pair must contain two distinct Value IDs")
  }

  const activeValueIdSet = new Set(activeDeck.valueIds)
  if (
    !activeValueIdSet.has(firstValueId) ||
    !activeValueIdSet.has(secondValueId)
  ) {
    throw new Error("Battle pair contains an inactive Value ID")
  }

  if (winnerId !== firstValueId && winnerId !== secondValueId) {
    throw new Error("Battle winner is not part of the active pair")
  }
}

export function createBattleProgressCandidate({
  activeDeck,
  progressById,
  cycleLevelSnapshot,
  pair,
  winnerId,
}: {
  readonly activeDeck: ActiveDeck
  readonly progressById: ValueProgressById
  readonly cycleLevelSnapshot: CycleLevelSnapshot
  readonly pair: ValuePair
  readonly winnerId: ValueId
}) {
  validateBattlePair(activeDeck, pair, winnerId)

  const validatedProgressById = createValueProgressById(
    activeDeck,
    Array.from(progressById),
  )
  const validatedCycleLevelSnapshot = validateCycleLevelSnapshot(
    activeDeck,
    cycleLevelSnapshot,
  )
  const loserId = pair[0] === winnerId ? pair[1] : pair[0]
  const priorWinnerProgress = validatedProgressById.get(winnerId)
  const priorLoserProgress = validatedProgressById.get(loserId)
  const opponentLevelAtCycleStart = validatedCycleLevelSnapshot.get(loserId)

  if (!priorWinnerProgress || !priorLoserProgress) {
    throw new Error("Battle progress is missing an active value")
  }

  if (opponentLevelAtCycleStart === undefined) {
    throw new Error("Battle snapshot is missing the losing value")
  }

  const xpGained = calculateCycleSnapshotXpPayout(opponentLevelAtCycleStart)
  const resultingWinnerProgress = Object.freeze({
    totalXp: addXp(priorWinnerProgress.totalXp, xpGained),
    profileWins: incrementCounter(
      priorWinnerProgress.profileWins,
      "Profile wins",
    ),
    profileComparisons: incrementCounter(
      priorWinnerProgress.profileComparisons,
      "Profile comparisons",
    ),
    currentCycleWins: incrementCounter(
      priorWinnerProgress.currentCycleWins,
      "Current-cycle wins",
    ),
  })
  const resultingLoserProgress = Object.freeze({
    ...priorLoserProgress,
    profileComparisons: incrementCounter(
      priorLoserProgress.profileComparisons,
      "Profile comparisons",
    ),
  })
  const candidateProgressById = new Map(validatedProgressById)
  candidateProgressById.set(winnerId, resultingWinnerProgress)
  candidateProgressById.set(loserId, resultingLoserProgress)
  const revisedProgressById = createValueProgressById(
    activeDeck,
    Array.from(candidateProgressById),
  )
  const storedWinnerProgress = revisedProgressById.get(winnerId)
  const storedLoserProgress = revisedProgressById.get(loserId)

  if (!storedWinnerProgress || !storedLoserProgress) {
    throw new Error("Battle candidate lost an active progress record")
  }

  return Object.freeze({
    progressById: revisedProgressById,
    delta: Object.freeze({
      pair: Object.freeze([...pair]) as ValuePair,
      winnerId,
      loserId,
      xpGained,
      priorWinnerProgress,
      resultingWinnerProgress: storedWinnerProgress,
      priorLoserProgress,
      resultingLoserProgress: storedLoserProgress,
    }),
  }) satisfies BattleProgressCandidate
}
