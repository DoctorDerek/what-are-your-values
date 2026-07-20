import { createActiveDeck } from "@game/data/src/ActiveDeck"
import { createCustomValueId } from "@game/data/src/Value"
import { createInitialValueProgress } from "@game/data/src/ValueProgress"
import { describe, expect, it } from "vitest"
import {
  createCycleLevelSnapshot,
  validateCycleLevelSnapshot,
} from "./CycleLevelSnapshot"

describe("Cycle Level Snapshot", () => {
  it("freezes every canonical value at its cycle-start level", () => {
    const activeDeck = createActiveDeck([])
    const snapshot = createCycleLevelSnapshot(
      activeDeck,
      createInitialValueProgress(activeDeck),
    )

    expect(snapshot.size).toBe(100)
    expect(new Set(snapshot.values())).toEqual(new Set([1]))
  })

  it("rejects incomplete, inactive, and invalid imported snapshot state", () => {
    const activeDeck = createActiveDeck([])
    const snapshot = createCycleLevelSnapshot(
      activeDeck,
      createInitialValueProgress(activeDeck),
    )
    const [firstValueId] = activeDeck.valueIds

    const incompleteSnapshot = new Map(snapshot)
    incompleteSnapshot.delete(firstValueId)
    expect(() =>
      validateCycleLevelSnapshot(activeDeck, incompleteSnapshot),
    ).toThrow("does not cover the complete Active Deck")

    const inactiveSnapshot = new Map(snapshot)
    inactiveSnapshot.delete(firstValueId)
    inactiveSnapshot.set(
      createCustomValueId("custom:00000000-0000-4000-8000-000000000044"),
      1,
    )
    expect(() =>
      validateCycleLevelSnapshot(activeDeck, inactiveSnapshot),
    ).toThrow("contains an inactive ID")

    const invalidLevelSnapshot = new Map(snapshot)
    invalidLevelSnapshot.set(firstValueId, 0)
    expect(() =>
      validateCycleLevelSnapshot(activeDeck, invalidLevelSnapshot),
    ).toThrow("Invalid cycle-snapshot level")
  })

  it("rejects progress that cannot initialize the complete snapshot", () => {
    const activeDeck = createActiveDeck([])
    const progressById = new Map(createInitialValueProgress(activeDeck))
    progressById.delete(activeDeck.valueIds[0])

    expect(() => createCycleLevelSnapshot(activeDeck, progressById)).toThrow(
      "Value Progress is missing",
    )
  })
})
