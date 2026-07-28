import { describe, expect, it } from "vitest"
import {
  MAX_PERSISTED_JSON_BYTES,
  MAX_PERSISTED_JSON_CONTAINER_NODES,
  MAX_PERSISTED_JSON_DEPTH,
  parsePersistedJson,
  serializePersistedJson,
} from "./PersistedJson"

describe("Persisted JSON", () => {
  it("round-trips deterministic tuple-only JSON", () => {
    const value = [1, "profile", [2, null, true]] as const
    const serialized = serializePersistedJson(value)

    expect(serialized).toBe('[1,"profile",[2,null,true]]')
    expect(parsePersistedJson(serialized)).toEqual(value)
  })

  it("rejects malformed, object-shaped, unsafe-number, and excessive-depth input", () => {
    expect(() => parsePersistedJson("[")).toThrow("Persisted JSON is malformed")
    expect(() => parsePersistedJson('{"__proto__":[]}')).toThrow(
      "Persisted JSON must use tuple arrays rather than objects",
    )
    expect(() => parsePersistedJson("[9007199254740992]")).toThrow(
      "Persisted JSON contains an unsafe number",
    )

    const excessiveDepth =
      "[".repeat(MAX_PERSISTED_JSON_DEPTH + 1) +
      "0" +
      "]".repeat(MAX_PERSISTED_JSON_DEPTH + 1)
    expect(() => parsePersistedJson(excessiveDepth)).toThrow(
      "Persisted JSON exceeds its structural depth limit",
    )
  })

  it("rejects excessive container nodes and encoded bytes", () => {
    const excessiveNodes = JSON.stringify([
      ...Array.from({ length: MAX_PERSISTED_JSON_CONTAINER_NODES }, () => []),
    ])
    expect(() => parsePersistedJson(excessiveNodes)).toThrow(
      "Persisted JSON exceeds its container node limit",
    )

    const excessiveBytes = `"${"a".repeat(MAX_PERSISTED_JSON_BYTES)}"`
    expect(() => parsePersistedJson(excessiveBytes)).toThrow(
      "Persisted JSON exceeds its byte limit",
    )
  })

  it("rejects values that JSON cannot serialize", () => {
    expect(() => serializePersistedJson(() => undefined)).toThrow(
      "Persisted value is not JSON serializable",
    )
  })
})
