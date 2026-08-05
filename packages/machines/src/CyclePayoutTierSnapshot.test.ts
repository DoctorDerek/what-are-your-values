import { createActiveDeck } from "@game/data/src/ActiveDeck"
import { createCustomValueId } from "@game/data/src/Value"
import { createInitialValueProgress } from "@game/data/src/ValueProgress"
import { describe, expect, it } from "vitest"
import {
  createCyclePayoutTierSnapshot,
  validateCyclePayoutTierSnapshot,
} from "./CyclePayoutTierSnapshot"

describe("Cycle Payout Tier Snapshot", () => {
  it("freezes every canonical value at its cycle-start payout tier", () => {
    const activeDeck = createActiveDeck([])
    const progressById = new Map(createInitialValueProgress(activeDeck))
    const [firstValueId] = activeDeck.valueIds
    progressById.set(firstValueId, {
      totalXp: 420,
      profileWins: 1,
      profileComparisons: 1,
      currentCycleWins: 0,
    })

    const snapshot = createCyclePayoutTierSnapshot(activeDeck, progressById)

    expect(snapshot.size).toBe(100)
    expect(snapshot.get(firstValueId)).toBe(15)
    expect(new Set(snapshot.values())).toEqual(new Set([1, 15]))
  })

  it("rejects incomplete, inactive, and invalid imported snapshot state", () => {
    const activeDeck = createActiveDeck([])
    const snapshot = createCyclePayoutTierSnapshot(
      activeDeck,
      createInitialValueProgress(activeDeck),
    )
    const [firstValueId] = activeDeck.valueIds

    const incompleteSnapshot = new Map(snapshot)
    incompleteSnapshot.delete(firstValueId)
    expect(() =>
      validateCyclePayoutTierSnapshot(activeDeck, incompleteSnapshot),
    ).toThrow("does not cover the complete Active Deck")

    const inactiveSnapshot = new Map(snapshot)
    inactiveSnapshot.delete(firstValueId)
    inactiveSnapshot.set(
      createCustomValueId("custom:00000000-0000-4000-8000-000000000044"),
      1,
    )
    expect(() =>
      validateCyclePayoutTierSnapshot(activeDeck, inactiveSnapshot),
    ).toThrow("contains an inactive ID")

    const invalidPayoutTierSnapshot = new Map(snapshot)
    invalidPayoutTierSnapshot.set(firstValueId, 0)
    expect(() =>
      validateCyclePayoutTierSnapshot(activeDeck, invalidPayoutTierSnapshot),
    ).toThrow("Invalid cycle-snapshot payout tier")
  })

  it("rejects progress that cannot initialize the complete snapshot", () => {
    const activeDeck = createActiveDeck([])
    const progressById = new Map(createInitialValueProgress(activeDeck))
    progressById.delete(activeDeck.valueIds[0])

    expect(() =>
      createCyclePayoutTierSnapshot(activeDeck, progressById),
    ).toThrow("Value Progress is missing")
  })
})
