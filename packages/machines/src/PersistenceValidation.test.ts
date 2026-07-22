import { describe, expect, it } from "vitest"
import { readIsoTimestamp } from "./PersistenceValidation"

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
})
