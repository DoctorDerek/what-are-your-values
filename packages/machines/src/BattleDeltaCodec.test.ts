import { getPairCount } from "@game/data/src/ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import { describe, expect, it } from "vitest"
import {
  createBattleCycleCandidate,
  createInitialBattleCycle,
} from "./BattleCycle"
import {
  decodeBattleDelta,
  encodeBattleDelta,
  getEncodedBattleDeltaByteLength,
} from "./BattleDeltaCodec"
import {
  applyBattleChoice,
  applyDeckRevision,
  createInitialBattleProfile,
} from "./BattleProfile"
import { projectBattlePair } from "./BattleScheduler"
import {
  createSchedulerRestorePoint,
  projectScheduledPair,
} from "./PairScheduler"

function createOrdinaryDelta() {
  const battleCycle = createInitialBattleCycle("delta-codec-seed")
  const [winnerId] = projectScheduledPair(
    battleCycle.activeDeck,
    battleCycle.scheduler,
  ).pair

  return createBattleCycleCandidate({
    battleCycle,
    winnerId,
    expectedScheduler: battleCycle.scheduler,
  }).delta
}

function createBoundaryEncodedDelta() {
  const initial = createInitialBattleCycle("boundary-metadata-codec-seed")
  const scheduler = createSchedulerRestorePoint({
    activeDeck: initial.activeDeck,
    progressGeneration: initial.scheduler.progressGeneration,
    deckRevision: initial.scheduler.deckRevision,
    seed: initial.scheduler.seed,
    cycleIndex: initial.scheduler.cycleIndex,
    cursor: getPairCount(initial.activeDeck.valueIds.length) - 1,
  })
  const [winnerId] = projectScheduledPair(initial.activeDeck, scheduler).pair
  const delta = createBattleCycleCandidate({
    battleCycle: Object.freeze({ ...initial, scheduler }),
    winnerId,
    expectedScheduler: scheduler,
  }).delta

  return { activeDeck: initial.activeDeck, encoded: encodeBattleDelta(delta) }
}

describe("Battle Delta Codec", () => {
  it("round-trips canonical ordinary evidence through compact tuples", () => {
    const battleCycle = createInitialBattleCycle("delta-codec-seed")
    const delta = createOrdinaryDelta()
    const encoded = encodeBattleDelta(delta)
    const decoded = decodeBattleDelta(battleCycle.activeDeck, encoded)

    expect(encodeBattleDelta(decoded)).toEqual(encoded)
    expect(decoded).toEqual(delta)
    expect(getEncodedBattleDeltaByteLength(delta)).toBe(
      new TextEncoder().encode(JSON.stringify(encoded)).byteLength,
    )
  })

  it("round-trips Join Pass scheduler evidence in a battle delta", () => {
    const customValue = Object.freeze({
      kind: "custom",
      id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
      name: "Ingenuity",
      definition: "To make original solutions.",
      creationOrdinal: 1,
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:00:00.000Z",
    }) satisfies CustomValueDefinition
    const initial = createInitialBattleProfile("join-pass-delta-seed")
    const revised = applyDeckRevision({
      profile: initial,
      revisedCustomValues: [customValue],
    }).profile
    const [winnerId] = projectBattlePair(revised.activeDeck, revised.scheduler)
    const delta = applyBattleChoice({
      profile: revised,
      winnerId,
      expectedScheduler: revised.scheduler,
    }).delta
    const encoded = encodeBattleDelta(delta)

    expect(decodeBattleDelta(revised.activeDeck, encoded)).toEqual(delta)
  })

  it("round-trips complete cycle-boundary snapshots and win maps", () => {
    const initial = createInitialBattleCycle("boundary-codec-seed")
    const scheduler = createSchedulerRestorePoint({
      activeDeck: initial.activeDeck,
      progressGeneration: initial.scheduler.progressGeneration,
      deckRevision: initial.scheduler.deckRevision,
      seed: initial.scheduler.seed,
      cycleIndex: initial.scheduler.cycleIndex,
      cursor: getPairCount(initial.activeDeck.valueIds.length) - 1,
    })
    const [winnerId] = projectScheduledPair(initial.activeDeck, scheduler).pair
    const boundaryState = Object.freeze({ ...initial, scheduler })
    const delta = createBattleCycleCandidate({
      battleCycle: boundaryState,
      winnerId,
      expectedScheduler: scheduler,
    }).delta
    const encoded = encodeBattleDelta(delta)
    const decoded = decodeBattleDelta(initial.activeDeck, encoded)

    expect(decoded.cycleBoundary).not.toBeNull()
    expect(encodeBattleDelta(decoded)).toEqual(encoded)
    expect(decoded.cycleBoundary?.priorCyclePayoutTierSnapshot).toBeInstanceOf(
      Map,
    )
    expect(decoded.cycleBoundary?.priorCurrentCycleWinsById).toBeInstanceOf(Map)
  })

  it("rejects version drift, inactive IDs, and tampered payouts", () => {
    const battleCycle = createInitialBattleCycle("delta-codec-seed")
    const encoded = encodeBattleDelta(createOrdinaryDelta())

    const unsupportedVersion = [2, ...encoded.slice(1)]
    expect(() =>
      decodeBattleDelta(battleCycle.activeDeck, unsupportedVersion),
    ).toThrow("Unsupported Battle Delta version")

    const inactivePair = [
      ...encoded.slice(0, 6),
      ["custom:00000000-0000-4000-8000-000000000001", encoded[6][1]],
      ...encoded.slice(7),
    ]
    expect(() =>
      decodeBattleDelta(battleCycle.activeDeck, inactivePair),
    ).toThrow("First pair Value ID is not in the Active Deck")

    const tamperedPayout = [
      ...encoded.slice(0, 9),
      encoded[9] + 1,
      ...encoded.slice(10),
    ]
    expect(() =>
      decodeBattleDelta(battleCycle.activeDeck, tamperedPayout),
    ).toThrow("Battle Delta progress transition is inconsistent")
  })

  it("rejects noncanonical cycle-map ordering", () => {
    const initial = createInitialBattleCycle("boundary-order-codec-seed")
    const scheduler = createSchedulerRestorePoint({
      activeDeck: initial.activeDeck,
      progressGeneration: 0,
      deckRevision: 0,
      seed: initial.scheduler.seed,
      cycleIndex: 0,
      cursor: getPairCount(initial.activeDeck.valueIds.length) - 1,
    })
    const [winnerId] = projectScheduledPair(initial.activeDeck, scheduler).pair
    const encoded = encodeBattleDelta(
      createBattleCycleCandidate({
        battleCycle: Object.freeze({ ...initial, scheduler }),
        winnerId,
        expectedScheduler: scheduler,
      }).delta,
    )
    const boundary = encoded[16]
    if (!boundary) {
      throw new Error("Boundary codec fixture is missing its transition")
    }

    const reorderedBoundary = [
      boundary[0],
      boundary[1],
      [...boundary[2]].reverse(),
      boundary[3],
      boundary[4],
      boundary[5],
    ]
    const reorderedDelta = [...encoded.slice(0, 16), reorderedBoundary]

    expect(() => decodeBattleDelta(initial.activeDeck, reorderedDelta)).toThrow(
      "Battle Delta encoding is not canonical",
    )
  })

  it("rejects malformed cycle-boundary and encoded identity metadata", () => {
    const { activeDeck, encoded } = createBoundaryEncodedDelta()
    const boundary = encoded[16]
    if (!boundary) {
      throw new Error("Boundary metadata fixture is missing its transition")
    }

    const unsupportedBoundaryVersion = [
      ...encoded.slice(0, 16),
      [2, ...boundary.slice(1)],
    ]
    const mismatchedCycleIdentity = [
      ...encoded.slice(0, 16),
      [boundary[0], `${boundary[1]}:tampered`, ...boundary.slice(2)],
    ]
    const mismatchedBattleIdentity = [
      encoded[0],
      `${encoded[1]}:tampered`,
      ...encoded.slice(2),
    ]

    expect(() =>
      decodeBattleDelta(activeDeck, unsupportedBoundaryVersion),
    ).toThrow("Unsupported Cycle Boundary Transition version")
    expect(() =>
      decodeBattleDelta(activeDeck, mismatchedCycleIdentity),
    ).toThrow("Cycle-complete event identity is inconsistent")
    expect(() =>
      decodeBattleDelta(activeDeck, mismatchedBattleIdentity),
    ).toThrow("Battle Delta identity does not match its encoded evidence")
  })
})
