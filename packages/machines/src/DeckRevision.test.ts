import { createActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
  type ValueId,
} from "@game/data/src/Value"
import {
  createInitialValueProgress,
  type ValueProgress,
  type ValueProgressById,
} from "@game/data/src/ValueProgress"
import { getLevelFromXP } from "@game/utils/src/LevelMath"
import { describe, expect, it } from "vitest"
import { createDeckRevisionCandidate } from "./DeckRevision"
import {
  FULL_CYCLE_SCHEDULE_KIND,
  JOIN_PASS_SCHEDULE_KIND,
} from "./SchedulerIdentity"

function createCustomValue(
  creationOrdinal: number,
  overrides: Partial<CustomValueDefinition> = {},
): CustomValueDefinition {
  const uuidSuffix = creationOrdinal.toString().padStart(12, "0")

  return {
    kind: "custom",
    id: createCustomValueId(`custom:00000000-0000-4000-8000-${uuidSuffix}`),
    name: `Custom Value ${creationOrdinal}`,
    definition: `Definition ${creationOrdinal}`,
    creationOrdinal,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
    ...overrides,
  }
}

function createProgress(
  totalXp: number,
  profileWins: number,
  profileComparisons: number,
  currentCycleWins: number,
): ValueProgress {
  return {
    totalXp,
    profileWins,
    profileComparisons,
    currentCycleWins,
  }
}

function setProgress(
  progressById: ValueProgressById,
  valueId: ValueId,
  progress: ValueProgress,
) {
  return new Map(progressById).set(valueId, progress)
}

describe("Deck Revision", () => {
  it("adds Ingenuity through a Join Pass without erasing retained progress", () => {
    const ingenuity = createCustomValue(1, {
      name: "Ingenuity",
      definition:
        "To solve problems in original, resourceful, and practical ways.",
    })
    const priorActiveDeck = createActiveDeck([])
    const curiosityId = priorActiveDeck.valueIds[22]
    const curiosityProgress = createProgress(10, 4, 7, 3)
    const priorProgressById = setProgress(
      createInitialValueProgress(priorActiveDeck),
      curiosityId,
      curiosityProgress,
    )
    const candidate = createDeckRevisionCandidate({
      priorActiveDeck,
      revisedCustomValues: [ingenuity],
      progressById: priorProgressById,
      deckRevision: 4,
      progressGeneration: 2,
      seed: "add-ingenuity",
    })

    expect(candidate.deckRevision).toBe(5)
    expect(candidate.progressGeneration).toBe(2)
    expect(candidate.activeDeck.customValues).toEqual([ingenuity])
    expect(candidate.joinedValueIds).toEqual([ingenuity.id])
    expect(candidate.scheduler.scheduleKind).toBe(JOIN_PASS_SCHEDULE_KIND)
    if (candidate.scheduler.scheduleKind !== JOIN_PASS_SCHEDULE_KIND) {
      throw new Error("Expected an Ingenuity Join Pass")
    }
    expect(candidate.scheduler.joinPairCount).toBe(100)
    expect(candidate.scheduler.pairCount).toBe(5_050)
    expect(candidate.progressById.get(curiosityId)).toEqual({
      ...curiosityProgress,
      currentCycleWins: 0,
    })
    expect(candidate.progressById.get(ingenuity.id)).toEqual({
      totalXp: 0,
      profileWins: 0,
      profileComparisons: 0,
      currentCycleWins: 0,
    })
    expect(candidate.cycleLevelSnapshot.get(curiosityId)).toBe(
      getLevelFromXP(curiosityProgress.totalXp),
    )
    expect(candidate.cycleLevelSnapshot.get(ingenuity.id)).toBe(1)
    expect(priorProgressById.get(curiosityId)).toEqual(curiosityProgress)
  })

  it("uses one exact Join Pass for a multi-value batch", () => {
    const revisedCustomValues = [
      createCustomValue(1),
      createCustomValue(2),
      createCustomValue(3),
    ]
    const priorActiveDeck = createActiveDeck([])
    const candidate = createDeckRevisionCandidate({
      priorActiveDeck,
      revisedCustomValues,
      progressById: createInitialValueProgress(priorActiveDeck),
      deckRevision: 0,
      progressGeneration: 0,
      seed: "batch-join",
    })

    expect(candidate.joinedValueIds).toEqual(
      revisedCustomValues.map(({ id }) => id),
    )
    expect(candidate.scheduler.scheduleKind).toBe(JOIN_PASS_SCHEDULE_KIND)
    if (candidate.scheduler.scheduleKind !== JOIN_PASS_SCHEDULE_KIND) {
      throw new Error("Expected a multi-value Join Pass")
    }
    expect(candidate.scheduler.joinPairCount).toBe(303)
    expect(candidate.scheduler.pairCount).toBe(5_253)
  })

  it("preserves identity through edits and starts a fresh full cycle", () => {
    const ingenuity = createCustomValue(1, { name: "Ingenuity" })
    const priorActiveDeck = createActiveDeck([ingenuity])
    const ingenuityProgress = createProgress(28, 8, 14, 4)
    const candidate = createDeckRevisionCandidate({
      priorActiveDeck,
      revisedCustomValues: [
        createCustomValue(1, {
          name: "Ingenuity",
          definition: "My edited definition",
        }),
      ],
      progressById: setProgress(
        createInitialValueProgress(priorActiveDeck),
        ingenuity.id,
        ingenuityProgress,
      ),
      deckRevision: 7,
      progressGeneration: 3,
      seed: "edit-ingenuity",
    })

    expect(candidate.joinedValueIds).toEqual([])
    expect(candidate.scheduler.scheduleKind).toBe(FULL_CYCLE_SCHEDULE_KIND)
    expect(candidate.progressById.get(ingenuity.id)).toEqual({
      ...ingenuityProgress,
      currentCycleWins: 0,
    })
    expect(candidate.activeDeck.fingerprint).not.toBe(
      priorActiveDeck.fingerprint,
    )
  })

  it("removes only deleted progress and starts a fresh full cycle", () => {
    const ingenuity = createCustomValue(1, { name: "Ingenuity" })
    const destiny = createCustomValue(2, { name: "Destiny" })
    const priorActiveDeck = createActiveDeck([ingenuity, destiny])
    const destinyProgress = createProgress(15, 5, 9, 2)
    const candidate = createDeckRevisionCandidate({
      priorActiveDeck,
      revisedCustomValues: [destiny],
      progressById: setProgress(
        createInitialValueProgress(priorActiveDeck),
        destiny.id,
        destinyProgress,
      ),
      deckRevision: 2,
      progressGeneration: 1,
      seed: "delete-ingenuity",
    })

    expect(candidate.progressById.has(ingenuity.id)).toBe(false)
    expect(candidate.progressById.get(destiny.id)).toEqual({
      ...destinyProgress,
      currentCycleWins: 0,
    })
    expect(candidate.scheduler.scheduleKind).toBe(FULL_CYCLE_SCHEDULE_KIND)
  })

  it("rejects no-op and unsafe revisions without a partial candidate", () => {
    const priorActiveDeck = createActiveDeck([])
    const progressById = createInitialValueProgress(priorActiveDeck)
    const createCandidate = (
      deckRevision: number,
      progressGeneration: number,
    ) =>
      createDeckRevisionCandidate({
        priorActiveDeck,
        revisedCustomValues: [],
        progressById,
        deckRevision,
        progressGeneration,
        seed: "invalid-revision",
      })

    expect(() => createCandidate(0, 0)).toThrow(
      "does not change Active Deck meaning",
    )
    expect(() =>
      createDeckRevisionCandidate({
        priorActiveDeck,
        revisedCustomValues: [createCustomValue(1)],
        progressById,
        deckRevision: Number.MAX_SAFE_INTEGER,
        progressGeneration: 0,
        seed: "unsafe-revision",
      }),
    ).toThrow("cannot be incremented safely")
    expect(() =>
      createDeckRevisionCandidate({
        priorActiveDeck,
        revisedCustomValues: [createCustomValue(1)],
        progressById,
        deckRevision: 0,
        progressGeneration: -1,
        seed: "invalid-generation",
      }),
    ).toThrow("Invalid progress generation")
  })
})
