import { createActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import { createInitialValueProgress } from "@game/data/src/ValueProgress"
import { describe, expect, it } from "vitest"
import {
  applyBattleChoice,
  applyBattleUndo,
  createInitialBattleProfile,
  type BattleProfile,
} from "./BattleProfile"
import { decodeBattleProfile, encodeBattleProfile } from "./BattleProfileCodec"
import { createCycleLevelSnapshot } from "./CycleLevelSnapshot"
import {
  createSchedulerRestorePoint,
  projectScheduledPair,
} from "./PairScheduler"

function chooseFirstValue(profile: BattleProfile) {
  const [winnerId] = projectScheduledPair(
    profile.activeDeck,
    profile.scheduler,
  ).pair

  return applyBattleChoice({
    profile,
    winnerId,
    expectedScheduler: profile.scheduler,
  })
}

function createCustomValue(): CustomValueDefinition {
  return {
    kind: "custom",
    id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
    name: "Ingenuity",
    definition:
      "To solve problems in original, resourceful, and practical ways",
    creationOrdinal: 1,
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
  }
}

function createCustomProfile(): BattleProfile {
  const activeDeck = createActiveDeck([createCustomValue()])
  const progressById = createInitialValueProgress(activeDeck)

  return {
    activeDeck,
    progressById,
    cycleLevelSnapshot: createCycleLevelSnapshot(activeDeck, progressById),
    scheduler: createSchedulerRestorePoint({
      activeDeck,
      progressGeneration: 0,
      deckRevision: 1,
      seed: "custom-profile-codec-seed",
      cycleIndex: 0,
    }),
    history: [],
    redo: [],
  }
}

describe("Battle Profile Codec", () => {
  it("round-trips current progress with executable History and Redo", () => {
    const initial = createInitialBattleProfile("profile-codec-seed")
    const first = chooseFirstValue(initial)
    const second = chooseFirstValue(first.profile)
    const undone = applyBattleUndo(second.profile)
    if (!undone) {
      throw new Error("The second battle cannot be undone")
    }

    const encoded = encodeBattleProfile(undone.profile)

    expect(decodeBattleProfile(encoded)).toEqual(undone.profile)
  })

  it("round-trips player-authored Active Deck definitions", () => {
    const profile = createCustomProfile()

    expect(decodeBattleProfile(encodeBattleProfile(profile))).toEqual(profile)
  })

  it("rejects unsupported versions and noncanonical ordered maps", () => {
    const profile = createInitialBattleProfile("profile-order-seed")
    const encoded = encodeBattleProfile(profile)

    expect(() => decodeBattleProfile([2, ...encoded.slice(1)])).toThrow(
      "Unsupported Battle Profile codec version",
    )
    expect(() =>
      decodeBattleProfile([
        ...encoded.slice(0, 3),
        [...encoded[3]].reverse(),
        ...encoded.slice(4),
      ]),
    ).toThrow("Battle Profile encoding is not canonical")
  })

  it("rejects profile state that disagrees with retained History", () => {
    const initial = createInitialBattleProfile("profile-evidence-seed")
    const committed = chooseFirstValue(initial)
    const encoded = encodeBattleProfile(committed.profile)

    expect(() =>
      decodeBattleProfile([
        ...encoded.slice(0, 2),
        encodeBattleProfile(initial)[2],
        ...encoded.slice(3),
      ]),
    ).toThrow("Undo progress does not match Battle Delta")
  })

  it("rejects timeline arrays above the validated delta capacity before replay", () => {
    const profile = createInitialBattleProfile("profile-capacity-seed")
    const committed = chooseFirstValue(profile)
    const encoded = encodeBattleProfile(committed.profile)
    const repeatedHistory = Array.from({ length: 513 }, () => encoded[5][0])

    expect(() =>
      decodeBattleProfile([...encoded.slice(0, 5), repeatedHistory, []]),
    ).toThrow("Battle Profile timeline exceeds its delta capacity")
  })
})
