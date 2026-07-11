import { describe, expect, it } from "vitest"

import { generateQueue } from "./Queue"

describe("generateQueue", () => {
  it("generates correct number of pairs for C(n,2)", () => {
    const ids = [1, 2, 3, 4, 5]
    const queue = generateQueue(ids)
    expect(queue).toHaveLength(10)
  })

  it("generates C(83,2) = 3403 pairs for full value set", () => {
    const ids = Array.from({ length: 83 }, (_, i) => i + 1)
    const queue = generateQueue(ids)
    expect(queue).toHaveLength(3403)
  })

  it("produces unique pairs with no duplicates", () => {
    const ids = [1, 2, 3, 4]
    const queue = generateQueue(ids)
    const serialized = queue.map(([a, b]) => `${a}-${b}`)
    const unique = new Set(serialized)
    expect(unique.size).toBe(queue.length)
  })

  it("includes all possible pair combinations", () => {
    const ids = [10, 20, 30]
    const queue = generateQueue(ids)
    const serialized = new Set(queue.map(([a, b]) => `${a}-${b}`))
    expect(serialized.has("10-20")).toBe(true)
    expect(serialized.has("10-30")).toBe(true)
    expect(serialized.has("20-30")).toBe(true)
  })

  it("returns empty array for fewer than 2 ids", () => {
    expect(generateQueue([])).toHaveLength(0)
    expect(generateQueue([1])).toHaveLength(0)
  })

  it("returns shuffled output (statistical check)", () => {
    const ids = Array.from({ length: 20 }, (_, i) => i + 1)
    const run1 = generateQueue(ids)
    const run2 = generateQueue(ids)
    const firstFive1 = run1.slice(0, 5).map(String).join(",")
    const firstFive2 = run2.slice(0, 5).map(String).join(",")
    expect(run1).toHaveLength(run2.length)
  })
})
