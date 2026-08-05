import { describe, expect, it } from "vitest"
import { mergeClassNames } from "./MergeClassNames"

describe("mergeClassNames", () => {
  it("combines conditional class values without rendering disabled entries", () => {
    expect(
      mergeClassNames("font-black", ["uppercase", null], {
        hidden: false,
        "text-primary": true,
      }),
    ).toBe("font-black uppercase text-primary")
  })

  it("keeps the final Tailwind utility when classes conflict", () => {
    expect(mergeClassNames("px-3 bg-primary", "px-5 bg-secondary")).toBe(
      "px-5 bg-secondary",
    )
  })
})
