import { describe, expect, it } from "vitest"
import { DurableStoreConflictError } from "./DurableStoreAdapter"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"

describe("In-Memory Durable Store", () => {
  it("atomically verifies expectations before writing and deleting", async () => {
    const store = createInMemoryDurableStore([
      ["manifest", "generation-0"],
      ["obsolete", "old"],
    ])

    await store.compareAndSwapVerified({
      expectedEntries: [["manifest", "generation-0"]],
      putEntries: [
        ["manifest", "generation-1"],
        ["journal.1", "event"],
      ],
      deleteKeys: ["obsolete"],
    })

    await expect(store.readAll()).resolves.toEqual(
      new Map([
        ["manifest", "generation-1"],
        ["journal.1", "event"],
      ]),
    )
  })

  it("rejects a stale expectation without applying any mutation", async () => {
    const store = createInMemoryDurableStore([["manifest", "generation-1"]])

    await expect(
      store.compareAndSwapVerified({
        expectedEntries: [["manifest", "generation-0"]],
        putEntries: [["manifest", "generation-2"]],
        deleteKeys: [],
      }),
    ).rejects.toBeInstanceOf(DurableStoreConflictError)
    await expect(store.readAll()).resolves.toEqual(
      new Map([["manifest", "generation-1"]]),
    )
  })

  it("rejects ambiguous write sets before touching stored entries", async () => {
    const store = createInMemoryDurableStore([["manifest", "generation-0"]])

    await expect(
      store.compareAndSwapVerified({
        expectedEntries: [["manifest", "generation-0"]],
        putEntries: [["manifest", "generation-1"]],
        deleteKeys: ["manifest"],
      }),
    ).rejects.toThrow(
      "Durable store transaction writes and deletes the same key",
    )
    await expect(store.readAll()).resolves.toEqual(
      new Map([["manifest", "generation-0"]]),
    )
  })

  it("rejects empty and duplicate durable-store keys before mutation", async () => {
    const store = createInMemoryDurableStore([["manifest", "generation-0"]])

    await expect(
      store.compareAndSwapVerified({
        expectedEntries: [["", null]],
        putEntries: [],
        deleteKeys: [],
      }),
    ).rejects.toThrow("Durable store expectations contains an empty key")
    await expect(
      store.compareAndSwapVerified({
        expectedEntries: [
          ["manifest", "generation-0"],
          ["manifest", "generation-0"],
        ],
        putEntries: [],
        deleteKeys: [],
      }),
    ).rejects.toThrow("Durable store expectations contains duplicate keys")
    await expect(
      store.compareAndSwapVerified({
        expectedEntries: [],
        putEntries: [],
        deleteKeys: ["manifest", "manifest"],
      }),
    ).rejects.toThrow("Durable store deletes contains duplicate keys")

    await expect(store.readAll()).resolves.toEqual(
      new Map([["manifest", "generation-0"]]),
    )
  })
})
