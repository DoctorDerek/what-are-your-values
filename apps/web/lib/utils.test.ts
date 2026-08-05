import { mergeClassNames } from "@game/utils/src/MergeClassNames"
import { describe, expect, it } from "vitest"
import { cn } from "./utils"

describe("Web Source Registry Utilities", () => {
  it("resolves the canonical shared class-merging implementation", () => {
    expect(cn).toBe(mergeClassNames)
  })
})
