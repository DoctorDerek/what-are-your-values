import { createActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import {
  createInitialValueProgress,
  type ValueProgressById,
} from "@game/data/src/ValueProgress"
import { describe, expect, it } from "vitest"
import { createProgressResetCandidate } from "./ProgressReset"
import { FULL_CYCLE_SCHEDULE_KIND } from "./SchedulerIdentity"

function createCustomValue(creationOrdinal: number): CustomValueDefinition {
  const uuidSuffix = creationOrdinal.toString().padStart(12, "0")

  return {
    kind: "custom",
    id: createCustomValueId(`custom:00000000-0000-4000-8000-${uuidSuffix}`),
    name: `Custom Value ${creationOrdinal}`,
    definition: `Definition ${creationOrdinal}`,
    creationOrdinal,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
  }
}

describe("Progress Reset", () => {
  it("resets levels and experience while preserving Active Deck meaning", () => {
    const ingenuity = createCustomValue(1)
    const activeDeck = createActiveDeck([ingenuity])
    const firstValueId = activeDeck.valueIds[0]
    const progressById = new Map(createInitialValueProgress(activeDeck)).set(
      firstValueId,
      {
        totalXp: 55,
        profileWins: 10,
        profileComparisons: 20,
        currentCycleWins: 4,
      },
    )
    const candidate = createProgressResetCandidate({
      activeDeck,
      progressById,
      deckRevision: 8,
      progressGeneration: 3,
      seed: "reset-levels-and-experience",
    })

    expect(candidate.activeDeck).toBe(activeDeck)
    expect(candidate.activeDeck.customValues).toEqual([ingenuity])
    expect(candidate.activeDeck.fingerprint).toBe(activeDeck.fingerprint)
    expect(candidate.deckRevision).toBe(8)
    expect(candidate.progressGeneration).toBe(4)
    expect(candidate.scheduler.scheduleKind).toBe(FULL_CYCLE_SCHEDULE_KIND)
    expect(candidate.scheduler.cycleIndex).toBe(0)
    expect(candidate.progressById.size).toBe(101)
    expect(
      Array.from(candidate.progressById.values()).every(
        ({ totalXp, profileWins, profileComparisons, currentCycleWins }) =>
          totalXp === 0 &&
          profileWins === 0 &&
          profileComparisons === 0 &&
          currentCycleWins === 0,
      ),
    ).toBe(true)
    expect(
      Array.from(candidate.cycleLevelSnapshot.values()).every(
        (level) => level === 1,
      ),
    ).toBe(true)
    expect(progressById.get(firstValueId)?.totalXp).toBe(55)
  })

  it("rejects corrupt profiles and unsafe generation boundaries", () => {
    const activeDeck = createActiveDeck([])
    const progressById = createInitialValueProgress(activeDeck)
    const incompleteProgressById = new Map(progressById)
    incompleteProgressById.delete(activeDeck.valueIds[0])
    const createCandidate = (
      candidateProgressById: ValueProgressById,
      progressGeneration: number,
    ) =>
      createProgressResetCandidate({
        activeDeck,
        progressById: candidateProgressById,
        deckRevision: 0,
        progressGeneration,
        seed: "invalid-reset",
      })

    expect(() => createCandidate(incompleteProgressById, 0)).toThrow(
      "does not cover the complete Active Deck",
    )
    expect(() =>
      createCandidate(progressById, Number.MAX_SAFE_INTEGER),
    ).toThrow("cannot be incremented safely")
    expect(() => createCandidate(progressById, -1)).toThrow(
      "Invalid progress generation",
    )
  })
})
