import { createActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import { describe, expect, it } from "vitest"
import { createInitialBattleCycle } from "./BattleCycle"
import { createDeckReconfigurationRestorePoint } from "./DeckReconfigurationScheduler"
import {
  decodeSchedulerRestorePoint,
  encodeSchedulerRestorePoint,
} from "./SchedulerCodec"

describe("Scheduler Codec", () => {
  it("round-trips the complete canonical restore point", () => {
    const battleCycle = createInitialBattleCycle("scheduler-codec-seed")
    const encoded = encodeSchedulerRestorePoint(battleCycle.scheduler)

    expect(
      decodeSchedulerRestorePoint(battleCycle.activeDeck, encoded, "Scheduler"),
    ).toEqual(battleCycle.scheduler)
  })

  it("round-trips Join Pass identity and compact membership state", () => {
    const customValue = Object.freeze({
      kind: "custom",
      id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
      name: "Ingenuity",
      definition: "To make original solutions.",
      creationOrdinal: 1,
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
    }) satisfies CustomValueDefinition
    const activeDeck = createActiveDeck([customValue])
    const scheduler = createDeckReconfigurationRestorePoint({
      activeDeck,
      joinedValueIds: [customValue.id],
      progressGeneration: 0,
      deckRevision: 1,
      seed: "join-pass-codec-seed",
      cycleIndex: 0,
    })
    const encoded = encodeSchedulerRestorePoint(scheduler)

    expect(
      decodeSchedulerRestorePoint(activeDeck, encoded, "Scheduler"),
    ).toEqual(scheduler)
  })

  it("rejects unsupported algorithms, mismatched decks, and invalid cursors", () => {
    const battleCycle = createInitialBattleCycle("scheduler-codec-error-seed")
    const encoded = encodeSchedulerRestorePoint(battleCycle.scheduler)

    expect(() =>
      decodeSchedulerRestorePoint(
        battleCycle.activeDeck,
        [2, ...encoded.slice(1)],
        "Scheduler",
      ),
    ).toThrow("Unsupported Scheduler algorithm version")
    expect(() =>
      decodeSchedulerRestorePoint(
        battleCycle.activeDeck,
        [encoded[0], "wrong-deck", ...encoded.slice(2)],
        "Scheduler",
      ),
    ).toThrow("Scheduler Active Deck fingerprint does not match")
    expect(() =>
      decodeSchedulerRestorePoint(
        battleCycle.activeDeck,
        [...encoded.slice(0, 7), Number.MAX_SAFE_INTEGER],
        "Scheduler",
      ),
    ).toThrow("Invalid scheduler cursor")
  })

  it("rejects malformed Join Pass membership arrays and noncanonical counts", () => {
    const customValue = Object.freeze({
      kind: "custom",
      id: createCustomValueId("custom:00000000-0000-4000-8000-000000000002"),
      name: "Ingenuity",
      definition: "To make original solutions.",
      creationOrdinal: 1,
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
    }) satisfies CustomValueDefinition
    const activeDeck = createActiveDeck([customValue])
    const scheduler = createDeckReconfigurationRestorePoint({
      activeDeck,
      joinedValueIds: [customValue.id],
      progressGeneration: 0,
      deckRevision: 1,
      seed: "scheduler-codec-errors-seed",
      cycleIndex: 0,
    })
    const encoded = encodeSchedulerRestorePoint(scheduler)

    const invalidRetainedValueIds = [...encoded] as unknown[]
    invalidRetainedValueIds[8] = null
    expect(() =>
      decodeSchedulerRestorePoint(
        activeDeck,
        invalidRetainedValueIds,
        "Scheduler",
      ),
    ).toThrow("Invalid Scheduler retained value IDs")

    const invalidJoinedValueIds = [...encoded] as unknown[]
    invalidJoinedValueIds[9] = null
    expect(() =>
      decodeSchedulerRestorePoint(
        activeDeck,
        invalidJoinedValueIds,
        "Scheduler",
      ),
    ).toThrow("Invalid Scheduler joined value IDs")

    const noncanonicalPairCount = [...encoded] as unknown[]
    noncanonicalPairCount[12] = 0
    expect(() =>
      decodeSchedulerRestorePoint(
        activeDeck,
        noncanonicalPairCount,
        "Scheduler",
      ),
    ).toThrow("Scheduler encoding is not canonical")
  })
})
