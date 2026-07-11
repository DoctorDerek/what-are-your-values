import { describe, expect, it } from "vitest"

import { getErrorMessage } from "./Errors"

describe("getErrorMessage", () => {
  it("extracts message from Error objects", () => {
    expect(getErrorMessage(new Error("test error"))).toBe("test error")
  })

  it("extracts message from plain objects with message property", () => {
    expect(getErrorMessage({ message: "custom error" })).toBe("custom error")
  })

  it("converts string throws to message", () => {
    expect(getErrorMessage("string error")).toBe('"string error"')
  })

  it("converts number throws to message", () => {
    expect(getErrorMessage(42)).toBe("42")
  })

  it("converts null to message", () => {
    expect(getErrorMessage(null)).toBe("null")
  })

  it("converts undefined to empty message", () => {
    expect(getErrorMessage(undefined)).toBe("")
  })

  it("handles objects without message property", () => {
    const result = getErrorMessage({ code: 404 })
    expect(typeof result).toBe("string")
    expect(result).toContain("404")
  })
})
