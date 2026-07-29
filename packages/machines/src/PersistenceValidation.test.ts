import { describe, expect, it } from "vitest"
import { createInitialBattleProfile } from "./BattleProfile"
import {
  readActiveValueId,
  readBoolean,
  readIsoTimestamp,
  readNonNegativeSafeInteger,
  readPositiveSafeInteger,
  readString,
  readTuple,
} from "./PersistenceValidation"

describe("Persistence Validation", () => {
  it("accepts only canonical ISO 8601 UTC timestamps", () => {
    expect(readIsoTimestamp("2026-07-21T04:30:15.123Z", "Updated at")).toBe(
      "2026-07-21T04:30:15.123Z",
    )
    expect(() => readIsoTimestamp("2026-07-21", "Updated at")).toThrow(
      "Invalid Updated at",
    )
    expect(() =>
      readIsoTimestamp("2026-07-21T04:30:15.123+00:00", "Updated at"),
    ).toThrow("Invalid Updated at")
    expect(() => readIsoTimestamp("not-a-date", "Updated at")).toThrow(
      "Invalid Updated at",
    )
  })

  it("rejects malformed primitive persistence values", () => {
    expect(() => readTuple("not-a-tuple", 1, "Record")).toThrow(
      "Invalid Record",
    )
    expect(() => readTuple(["one"], 2, "Record")).toThrow("Invalid Record")
    expect(() => readString(42, "Name")).toThrow("Invalid Name")
    expect(readBoolean(true, "Enabled")).toBe(true)
    expect(() => readBoolean("true", "Enabled")).toThrow("Invalid Enabled")
    expect(() => readNonNegativeSafeInteger(-1, "Generation")).toThrow(
      "Invalid Generation",
    )
    expect(() =>
      readNonNegativeSafeInteger(Number.MAX_SAFE_INTEGER + 1, "Generation"),
    ).toThrow("Invalid Generation")
    expect(() => readPositiveSafeInteger(0, "Revision")).toThrow(
      "Invalid Revision",
    )
  })

  it("accepts active values and rejects values outside the active deck", () => {
    const activeDeck = createInitialBattleProfile("validation-seed").activeDeck
    const firstValueId = activeDeck.valueIds[0]
    if (!firstValueId) {
      throw new Error("The validation fixture has no active values")
    }

    expect(readActiveValueId(activeDeck, firstValueId, "Value")).toBe(
      firstValueId,
    )
    expect(() =>
      readActiveValueId(activeDeck, "missing-value", "Value"),
    ).toThrow("Value is not in the Active Deck: missing-value")
  })
})
