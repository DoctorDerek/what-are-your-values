import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import type { ValueProgressById } from "@game/data/src/ValueProgress"
import { getPayoutTierFromXP } from "@game/utils/src/LevelMath"

export type CyclePayoutTierSnapshot = ReadonlyMap<ValueId, number>

function validateSnapshotPayoutTier(valueId: ValueId, payoutTier: number) {
  if (!Number.isSafeInteger(payoutTier) || payoutTier < 1) {
    throw new Error(
      `Invalid cycle-snapshot payout tier for ${valueId}: ${payoutTier}`,
    )
  }
}

export function validateCyclePayoutTierSnapshot(
  activeDeck: ActiveDeck,
  candidateSnapshot: CyclePayoutTierSnapshot,
): CyclePayoutTierSnapshot {
  if (candidateSnapshot.size !== activeDeck.valueIds.length) {
    throw new Error(
      "Cycle Payout Tier Snapshot does not cover the complete Active Deck",
    )
  }

  const activeValueIdSet = new Set(activeDeck.valueIds)
  candidateSnapshot.forEach((payoutTier, valueId) => {
    if (!activeValueIdSet.has(valueId)) {
      throw new Error(
        `Cycle Payout Tier Snapshot contains an inactive ID: ${valueId}`,
      )
    }

    validateSnapshotPayoutTier(valueId, payoutTier)
  })

  return new Map(
    activeDeck.valueIds.map((valueId) => {
      const payoutTier = candidateSnapshot.get(valueId)

      if (payoutTier === undefined) {
        throw new Error(`Cycle Payout Tier Snapshot is missing ${valueId}`)
      }

      return [valueId, payoutTier] as const
    }),
  ) satisfies CyclePayoutTierSnapshot
}

export function createCyclePayoutTierSnapshot(
  activeDeck: ActiveDeck,
  progressById: ValueProgressById,
): CyclePayoutTierSnapshot {
  return validateCyclePayoutTierSnapshot(
    activeDeck,
    new Map(
      activeDeck.valueIds.map((valueId) => {
        const progress = progressById.get(valueId)

        if (!progress) {
          throw new Error(`Value Progress is missing ${valueId}`)
        }

        return [valueId, getPayoutTierFromXP(progress.totalXp)] as const
      }),
    ),
  )
}
