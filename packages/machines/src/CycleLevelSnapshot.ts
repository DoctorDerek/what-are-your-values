import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import type { ValueProgressById } from "@game/data/src/ValueProgress"
import { getLevelFromXP } from "@game/utils/src/LevelMath"

export type CycleLevelSnapshot = ReadonlyMap<ValueId, number>

function validateSnapshotLevel(valueId: ValueId, level: number) {
  if (!Number.isSafeInteger(level) || level < 1) {
    throw new Error(`Invalid cycle-snapshot level for ${valueId}: ${level}`)
  }
}

export function validateCycleLevelSnapshot(
  activeDeck: ActiveDeck,
  candidateSnapshot: CycleLevelSnapshot,
): CycleLevelSnapshot {
  if (candidateSnapshot.size !== activeDeck.valueIds.length) {
    throw new Error("Cycle Level Snapshot does not cover the complete Active Deck")
  }

  const activeValueIdSet = new Set(activeDeck.valueIds)
  candidateSnapshot.forEach((level, valueId) => {
    if (!activeValueIdSet.has(valueId)) {
      throw new Error(`Cycle Level Snapshot contains an inactive ID: ${valueId}`)
    }

    validateSnapshotLevel(valueId, level)
  })

  return new Map(
    activeDeck.valueIds.map((valueId) => {
      const level = candidateSnapshot.get(valueId)

      if (level === undefined) {
        throw new Error(`Cycle Level Snapshot is missing ${valueId}`)
      }

      return [valueId, level] as const
    }),
  ) satisfies CycleLevelSnapshot
}

export function createCycleLevelSnapshot(
  activeDeck: ActiveDeck,
  progressById: ValueProgressById,
): CycleLevelSnapshot {
  return validateCycleLevelSnapshot(
    activeDeck,
    new Map(
      activeDeck.valueIds.map((valueId) => {
        const progress = progressById.get(valueId)

        if (!progress) {
          throw new Error(`Value Progress is missing ${valueId}`)
        }

        return [valueId, getLevelFromXP(progress.totalXp)] as const
      }),
    ),
  )
}
