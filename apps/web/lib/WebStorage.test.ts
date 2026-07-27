import { afterEach, describe, expect, it } from "vitest"
import { webStorage } from "@/lib/WebStorage"

describe("web storage adapter", () => {
  afterEach(() => {
    localStorage.clear()
  })

  it("persists and reads a browser storage value", () => {
    webStorage.setItem("wayvm-test-key", "wayvm-test-value")

    expect(webStorage.getItem("wayvm-test-key")).toBe("wayvm-test-value")
  })
})
