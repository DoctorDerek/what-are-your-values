import {
  DurableStoreConflictError,
  type DurableStoreTransaction,
} from "@game/machines/src/DurableStoreAdapter"
import { IDBFactory } from "fake-indexeddb"
import { describe, expect, it, vi } from "vitest"
import { createIndexedDbDurableStore } from "./IndexedDbDurableStore"

function createRawStore(indexedDb: IDBFactory) {
  return createIndexedDbDurableStore(() => indexedDb)
}

function createTransaction(
  expectedEntries: DurableStoreTransaction["expectedEntries"],
  putEntries: DurableStoreTransaction["putEntries"],
  deleteKeys: DurableStoreTransaction["deleteKeys"],
) {
  return { expectedEntries, putEntries, deleteKeys }
}

describe("IndexedDB durable store", () => {
  it("rejects blocked database upgrades and closes a late success", async () => {
    const close = vi.fn()
    const indexedDb = {
      open: vi.fn(() => {
        const request = {
          result: { close },
        } as unknown as IDBOpenDBRequest
        queueMicrotask(() => {
          request.onblocked?.(new Event("blocked") as IDBVersionChangeEvent)
          request.onsuccess?.(new Event("success"))
        })
        return request
      }),
    } as unknown as IDBFactory
    const store = createRawStore(indexedDb)

    await expect(store.readAll()).rejects.toThrow(
      "Durable storage upgrade is blocked",
    )
    expect(close).toHaveBeenCalledOnce()
  })

  it("surfaces an IndexedDB open error when the browser provides none", async () => {
    const indexedDb = {
      open: vi.fn(() => {
        const request = { error: null } as unknown as IDBOpenDBRequest
        queueMicrotask(() => request.onerror?.(new Event("error")))
        return request
      }),
    } as unknown as IDBFactory
    const store = createRawStore(indexedDb)

    await expect(store.readAll()).rejects.toThrow(
      "Unable to open durable storage",
    )
  })

  it("queues writes immediately when no expectations are required", async () => {
    const indexedDb = new IDBFactory()
    const store = createRawStore(indexedDb)

    await store.compareAndSwapVerified(
      createTransaction([], [["first-write", "ready"]], []),
    )

    await expect(store.readAll()).resolves.toEqual(
      new Map([["first-write", "ready"]]),
    )
  })

  it("round-trips values through read and compare-and-swap updates", async () => {
    const indexedDb = new IDBFactory()
    const store = createRawStore(indexedDb)

    await store.compareAndSwapVerified(
      createTransaction(
        [["alpha", null]],
        [
          ["alpha", "A"],
          ["beta", "B"],
        ],
        [],
      ),
    )

    const initialEntries = await store.readAll()
    expect(initialEntries.get("alpha")).toBe("A")
    expect(initialEntries.get("beta")).toBe("B")

    await store.compareAndSwapVerified(
      createTransaction(
        [
          ["alpha", "A"],
          ["beta", "B"],
        ],
        [["alpha", "A1"]],
        ["beta"],
      ),
    )

    const finalEntries = await store.readAll()
    expect(finalEntries.get("alpha")).toBe("A1")
    expect(finalEntries.has("beta")).toBe(false)
    expect(finalEntries.size).toBe(1)
  })

  it("throws a conflict error when expectation does not match", async () => {
    const indexedDb = new IDBFactory()
    const store = createRawStore(indexedDb)

    await store.compareAndSwapVerified(
      createTransaction([["only", null]], [["only", "value"]], []),
    )

    await expect(
      store.compareAndSwapVerified(
        createTransaction([["only", "stale"]], [["only", "updated"]], []),
      ),
    ).rejects.toBeInstanceOf(DurableStoreConflictError)
  })

  it("detects non-string storage content on read", async () => {
    const indexedDb = new IDBFactory()
    const store = createRawStore(indexedDb)

    await store.compareAndSwapVerified(
      createTransaction([["seed", null]], [["seed", "ready"]], []),
    )

    await new Promise<void>((resolve, reject) => {
      const dbRequest = indexedDb.open("what-are-your-values-mapache", 1)

      dbRequest.onsuccess = () => {
        const db = dbRequest.result
        const tx = db.transaction("battle-profile", "readwrite")
        const objectStore = tx.objectStore("battle-profile")
        objectStore.put({ not: "a string" }, "corrupt")
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () =>
          reject(tx.error ?? new Error("Unable to corrupt durable storage"))
      }
      dbRequest.onerror = () =>
        reject(new Error("Unable to open durable store for corruption test"))
    })

    await expect(store.readAll()).rejects.toThrow(
      "Durable storage contains a non-string entry",
    )
  })
})
