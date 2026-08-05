import { MAX_SUPPORTED_TOTAL_XP } from "@game/utils/src/LevelMath"
import { describe, expect, it } from "vitest"
import { createActiveDeck } from "./ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
  type ValueId,
} from "./Value"
import {
  beginNextValueProgressCycle,
  createInitialValueProgress,
  createValueProgress,
  createValueProgressById,
  reconfigureValueProgress,
  resetValueProgress,
  type ValueProgress,
  type ValueProgressById,
} from "./ValueProgress"

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

function createPlayedProgress(
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

function replaceProgress(
  progressById: ValueProgressById,
  valueId: ValueId,
  progress: ValueProgress,
) {
  return new Map(progressById).set(valueId, progress)
}

describe("Value Progress construction", () => {
  it("creates exact zeroed progress for every active value", () => {
    const activeDeck = createActiveDeck([createCustomValue(1)])
    const progressById = createInitialValueProgress(activeDeck)

    expect(progressById.size).toBe(101)
    expect(Array.from(progressById.keys())).toEqual(activeDeck.valueIds)
    progressById.forEach((progress) => {
      expect(progress).toEqual({
        totalXp: 0,
        profileWins: 0,
        profileComparisons: 0,
        currentCycleWins: 0,
      })
      expect(Object.isFrozen(progress)).toBe(true)
    })
  })

  it("defensively clones validated progress records in Active Deck order", () => {
    const activeDeck = createActiveDeck([])
    const candidate = createPlayedProgress(12, 3, 5, 2)
    const entries = activeDeck.valueIds
      .map(
        (valueId, index) =>
          [
            valueId,
            index === 0 ? candidate : createPlayedProgress(0, 0, 0, 0),
          ] as const,
      )
      .reverse()
    const progressById = createValueProgressById(activeDeck, entries)

    expect(Array.from(progressById.keys())).toEqual(activeDeck.valueIds)
    expect(progressById.get(activeDeck.valueIds[0])).toEqual(candidate)
    expect(progressById.get(activeDeck.valueIds[0])).not.toBe(candidate)
  })
})

describe("Value Progress reconfiguration", () => {
  it("preserves every retained record and initializes only a joined value", () => {
    const ingenuity = createCustomValue(1, { name: "Ingenuity" })
    const priorActiveDeck = createActiveDeck([])
    const revisedActiveDeck = createActiveDeck([ingenuity])
    const curiosityId = priorActiveDeck.valueIds[22]
    const playedProgress = createPlayedProgress(36, 8, 12, 3)
    const progressById = replaceProgress(
      createInitialValueProgress(priorActiveDeck),
      curiosityId,
      playedProgress,
    )
    const revisedProgressById = reconfigureValueProgress({
      priorActiveDeck,
      revisedActiveDeck,
      progressById,
    })

    expect(revisedProgressById.size).toBe(101)
    expect(revisedProgressById.get(curiosityId)).toEqual({
      ...playedProgress,
      currentCycleWins: 0,
    })
    expect(revisedProgressById.get(ingenuity.id)).toEqual({
      totalXp: 0,
      profileWins: 0,
      profileComparisons: 0,
      currentCycleWins: 0,
    })
  })

  it("preserves identity progress across edits and removes only deleted IDs", () => {
    const ingenuity = createCustomValue(1, { name: "Ingenuity" })
    const destiny = createCustomValue(2, { name: "Destiny" })
    const priorActiveDeck = createActiveDeck([ingenuity, destiny])
    const editedActiveDeck = createActiveDeck([
      createCustomValue(1, {
        name: "Ingenuity",
        definition: "An edited personal definition",
      }),
      destiny,
    ])
    const ingenuityProgress = createPlayedProgress(24, 6, 9, 2)
    const destinyProgress = createPlayedProgress(16, 4, 7, 1)
    const progressById = replaceProgress(
      replaceProgress(
        createInitialValueProgress(priorActiveDeck),
        ingenuity.id,
        ingenuityProgress,
      ),
      destiny.id,
      destinyProgress,
    )
    const editedProgressById = reconfigureValueProgress({
      priorActiveDeck,
      revisedActiveDeck: editedActiveDeck,
      progressById,
    })
    const deletedProgressById = reconfigureValueProgress({
      priorActiveDeck: editedActiveDeck,
      revisedActiveDeck: createActiveDeck([editedActiveDeck.customValues[0]]),
      progressById: editedProgressById,
    })

    expect(editedProgressById.get(ingenuity.id)).toEqual({
      ...ingenuityProgress,
      currentCycleWins: 0,
    })
    expect(editedProgressById.get(destiny.id)).toEqual({
      ...destinyProgress,
      currentCycleWins: 0,
    })
    expect(deletedProgressById.get(ingenuity.id)).toEqual({
      ...ingenuityProgress,
      currentCycleWins: 0,
    })
    expect(deletedProgressById.has(destiny.id)).toBe(false)
    expect(deletedProgressById.size).toBe(101)
  })

  it("resets progress without changing Active Deck membership", () => {
    const activeDeck = createActiveDeck([createCustomValue(1)])
    const resetProgressById = resetValueProgress(activeDeck)

    expect(Array.from(resetProgressById.keys())).toEqual(activeDeck.valueIds)
    expect(
      Array.from(resetProgressById.values()).every(
        ({ totalXp }) => totalXp === 0,
      ),
    ).toBe(true)
  })

  it("starts the next pair cycle without erasing lifetime evidence", () => {
    const activeDeck = createActiveDeck([])
    const [firstValueId, secondValueId] = activeDeck.valueIds
    const firstProgress = createPlayedProgress(24, 6, 9, 2)
    const secondProgress = createPlayedProgress(16, 4, 7, 1)
    const progressById = replaceProgress(
      replaceProgress(
        createInitialValueProgress(activeDeck),
        firstValueId,
        firstProgress,
      ),
      secondValueId,
      secondProgress,
    )
    const nextCycleProgressById = beginNextValueProgressCycle(
      activeDeck,
      progressById,
    )

    expect(nextCycleProgressById.get(firstValueId)).toEqual({
      ...firstProgress,
      currentCycleWins: 0,
    })
    expect(nextCycleProgressById.get(secondValueId)).toEqual({
      ...secondProgress,
      currentCycleWins: 0,
    })
    expect(progressById.get(firstValueId)).toEqual(firstProgress)
  })
})

describe("Value Progress validation", () => {
  it("exposes one canonical validator for durable progress boundaries", () => {
    const valueId = createActiveDeck([]).valueIds[0]
    const candidate = createPlayedProgress(12, 3, 5, 2)
    const progress = createValueProgress(valueId, candidate)

    expect(progress).toEqual(candidate)
    expect(progress).not.toBe(candidate)
    expect(Object.isFrozen(progress)).toBe(true)
    expect(() =>
      createValueProgress(valueId, createPlayedProgress(12, 3, 2, 0)),
    ).toThrow("Profile wins exceed comparisons")
  })

  it("rejects missing, duplicate, and inactive IDs", () => {
    const activeDeck = createActiveDeck([])
    const validEntries = Array.from(createInitialValueProgress(activeDeck))
    const inactiveValueId = createCustomValue(1).id

    expect(() =>
      createValueProgressById(activeDeck, validEntries.slice(1)),
    ).toThrow("does not cover the complete Active Deck")
    expect(() =>
      createValueProgressById(activeDeck, [validEntries[0], ...validEntries]),
    ).toThrow("Duplicate Value Progress ID")
    expect(() =>
      createValueProgressById(activeDeck, [
        ...validEntries.slice(1),
        [inactiveValueId, createPlayedProgress(0, 0, 0, 0)],
      ]),
    ).toThrow("inactive ID")
  })

  it.each([
    [createPlayedProgress(-1, 0, 0, 0), "Invalid total XP"],
    [createPlayedProgress(0, 0, -1, 0), "Invalid profile comparisons"],
    [createPlayedProgress(2, 0, 0, 0), "Total XP is not divisible by 4"],
    [createPlayedProgress(666, 0, 0, 0), "Total XP is not divisible by 4"],
    [createPlayedProgress(4, 2, 2, 0), "Total XP is lower"],
    [createPlayedProgress(12, 3, 2, 0), "Profile wins exceed"],
    [createPlayedProgress(8, 2, 3, 3), "Current-cycle wins exceed"],
  ])("rejects inconsistent counters: %s", (invalidProgress, error) => {
    const activeDeck = createActiveDeck([])
    const entries = Array.from(createInitialValueProgress(activeDeck))
    entries[0] = [entries[0][0], invalidProgress]

    expect(() => createValueProgressById(activeDeck, entries)).toThrow(error)
  })

  it("shares the exact supported total-XP boundary with level derivation", () => {
    const activeDeck = createActiveDeck([])
    const entries = Array.from(createInitialValueProgress(activeDeck))
    const firstValueId = entries[0][0]

    entries[0] = [
      firstValueId,
      createPlayedProgress(MAX_SUPPORTED_TOTAL_XP, 0, 0, 0),
    ]
    expect(
      createValueProgressById(activeDeck, entries).get(firstValueId)?.totalXp,
    ).toBe(MAX_SUPPORTED_TOTAL_XP)

    entries[0] = [
      firstValueId,
      createPlayedProgress(MAX_SUPPORTED_TOTAL_XP + 1, 0, 0, 0),
    ]
    expect(() => createValueProgressById(activeDeck, entries)).toThrow(
      "Invalid total XP",
    )
  })
})
