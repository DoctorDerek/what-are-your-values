import { describe, expect, it } from "vitest"
import { createInitialBattleCycle } from "./BattleCycle"
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
})
