import { DurableStoreConflictError } from "@game/machines/src/DurableStoreAdapter"
import { describe, expect, it } from "vitest"
import {
  createAsyncStorageDurableStore,
  type AsyncStorageDurableStoreClient,
} from "./AsyncStorageDurableStore"

const PROFILE_KEY = "wayvm.snapshot.manifest"
const SNAPSHOT_KEY = "wayvm.snapshot.a"
const UNRELATED_KEY = "expo.unrelated"

function createFakeAsyncStorage(
  initialEntries: readonly (readonly [string, string])[] = [],
) {
  const entries = new Map(initialEntries)
  const client = Object.freeze({
    getAllKeys: async () => Array.from(entries.keys()),
    multiGet: async (keys) =>
      keys.map((key) => [key, entries.get(key) ?? null] as const),
    multiSet: async (keyValuePairs) => {
      keyValuePairs.forEach(([key, value]) => {
        entries.set(key, value)
      })
    },
    multiRemove: async (keys) => {
      keys.forEach((key) => {
        entries.delete(key)
      })
    },
  }) satisfies AsyncStorageDurableStoreClient

  return Object.freeze({ client, entries })
}

function createDeferred() {
  let resolvePromise!: () => void
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })
  return Object.freeze({ promise, resolve: resolvePromise })
}

describe("createAsyncStorageDurableStore", () => {
  it("reads only WAYVM-owned string entries", async () => {
    const { client } = createFakeAsyncStorage([
      [PROFILE_KEY, "manifest"],
      [SNAPSHOT_KEY, "snapshot"],
      [UNRELATED_KEY, "untouched"],
    ])
    const store = createAsyncStorageDurableStore(client)

    await expect(store.readAll()).resolves.toEqual(
      new Map([
        [PROFILE_KEY, "manifest"],
        [SNAPSHOT_KEY, "snapshot"],
      ]),
    )
  })

  it("accepts an empty store and no-op transaction", async () => {
    const { client } = createFakeAsyncStorage()
    const store = createAsyncStorageDurableStore(client)

    await expect(store.readAll()).resolves.toEqual(new Map())
    await expect(
      store.compareAndSwapVerified({
        expectedEntries: [],
        putEntries: [],
        deleteKeys: [],
      }),
    ).resolves.toBeUndefined()
  })

  it("verifies compare-and-swap writes and deletes", async () => {
    const { client, entries } = createFakeAsyncStorage([
      [PROFILE_KEY, "before"],
      [SNAPSHOT_KEY, "obsolete"],
      [UNRELATED_KEY, "untouched"],
    ])
    const store = createAsyncStorageDurableStore(client)

    await store.compareAndSwapVerified({
      expectedEntries: [
        [PROFILE_KEY, "before"],
        [SNAPSHOT_KEY, "obsolete"],
      ],
      putEntries: [[PROFILE_KEY, "after"]],
      deleteKeys: [SNAPSHOT_KEY],
    })

    expect(entries).toEqual(
      new Map([
        [PROFILE_KEY, "after"],
        [UNRELATED_KEY, "untouched"],
      ]),
    )
  })

  it("rejects expectation conflicts without changing persisted bytes", async () => {
    const { client, entries } = createFakeAsyncStorage([
      [PROFILE_KEY, "current"],
    ])
    const store = createAsyncStorageDurableStore(client)

    await expect(
      store.compareAndSwapVerified({
        expectedEntries: [[PROFILE_KEY, "stale"]],
        putEntries: [[PROFILE_KEY, "replacement"]],
        deleteKeys: [],
      }),
    ).rejects.toBeInstanceOf(DurableStoreConflictError)
    expect(entries).toEqual(new Map([[PROFILE_KEY, "current"]]))
  })

  it("serializes concurrent compare-and-swap operations", async () => {
    const { client, entries } = createFakeAsyncStorage([[PROFILE_KEY, "first"]])
    const firstWriteStarted = createDeferred()
    const releaseFirstWrite = createDeferred()
    let shouldDelayWrite = true
    const delayedClient = Object.freeze({
      ...client,
      multiSet: async (keyValuePairs) => {
        if (shouldDelayWrite) {
          shouldDelayWrite = false
          firstWriteStarted.resolve()
          await releaseFirstWrite.promise
        }
        await client.multiSet(keyValuePairs)
      },
    }) satisfies AsyncStorageDurableStoreClient
    const store = createAsyncStorageDurableStore(delayedClient)

    const firstOperation = store.compareAndSwapVerified({
      expectedEntries: [[PROFILE_KEY, "first"]],
      putEntries: [[PROFILE_KEY, "second"]],
      deleteKeys: [],
    })
    await firstWriteStarted.promise
    const secondOperation = store.compareAndSwapVerified({
      expectedEntries: [[PROFILE_KEY, "second"]],
      putEntries: [[PROFILE_KEY, "third"]],
      deleteKeys: [],
    })
    releaseFirstWrite.resolve()

    await expect(
      Promise.all([firstOperation, secondOperation]),
    ).resolves.toEqual([undefined, undefined])
    expect(entries.get(PROFILE_KEY)).toBe("third")
  })

  it("detects a write that AsyncStorage did not persist", async () => {
    const { client } = createFakeAsyncStorage([[PROFILE_KEY, "before"]])
    const ignoredWriteClient = Object.freeze({
      ...client,
      multiSet: async () => undefined,
    }) satisfies AsyncStorageDurableStoreClient
    const store = createAsyncStorageDurableStore(ignoredWriteClient)

    await expect(
      store.compareAndSwapVerified({
        expectedEntries: [[PROFILE_KEY, "before"]],
        putEntries: [[PROFILE_KEY, "after"]],
        deleteKeys: [],
      }),
    ).rejects.toThrow(
      `Durable store write verification failed for ${PROFILE_KEY}`,
    )
  })

  it("detects a delete that AsyncStorage did not persist", async () => {
    const { client } = createFakeAsyncStorage([[PROFILE_KEY, "before"]])
    const ignoredDeleteClient = Object.freeze({
      ...client,
      multiRemove: async () => undefined,
    }) satisfies AsyncStorageDurableStoreClient
    const store = createAsyncStorageDurableStore(ignoredDeleteClient)

    await expect(
      store.compareAndSwapVerified({
        expectedEntries: [[PROFILE_KEY, "before"]],
        putEntries: [],
        deleteKeys: [PROFILE_KEY],
      }),
    ).rejects.toThrow(
      `Durable store delete verification failed for ${PROFILE_KEY}`,
    )
  })

  it("keeps the operation queue usable after a storage failure", async () => {
    const { client, entries } = createFakeAsyncStorage([
      [PROFILE_KEY, "before"],
    ])
    let shouldFailWrite = true
    const recoveringClient = Object.freeze({
      ...client,
      multiSet: async (keyValuePairs) => {
        if (shouldFailWrite) {
          shouldFailWrite = false
          throw new Error("Native write failed")
        }
        await client.multiSet(keyValuePairs)
      },
    }) satisfies AsyncStorageDurableStoreClient
    const store = createAsyncStorageDurableStore(recoveringClient)

    await expect(
      store.compareAndSwapVerified({
        expectedEntries: [[PROFILE_KEY, "before"]],
        putEntries: [[PROFILE_KEY, "failed"]],
        deleteKeys: [],
      }),
    ).rejects.toThrow("Native write failed")
    await expect(
      store.compareAndSwapVerified({
        expectedEntries: [[PROFILE_KEY, "before"]],
        putEntries: [[PROFILE_KEY, "recovered"]],
        deleteKeys: [],
      }),
    ).resolves.toBeUndefined()
    expect(entries.get(PROFILE_KEY)).toBe("recovered")
  })

  it("rejects transactions outside the WAYVM key namespace", async () => {
    const { client, entries } = createFakeAsyncStorage([
      [UNRELATED_KEY, "untouched"],
    ])
    const store = createAsyncStorageDurableStore(client)

    await expect(
      store.compareAndSwapVerified({
        expectedEntries: [[UNRELATED_KEY, "untouched"]],
        putEntries: [[UNRELATED_KEY, "changed"]],
        deleteKeys: [],
      }),
    ).rejects.toThrow(
      "Durable store expectations contains a key outside the WAYVM namespace",
    )
    expect(entries.get(UNRELATED_KEY)).toEqual("untouched")
  })

  it("rejects malformed key enumeration", async () => {
    const { client } = createFakeAsyncStorage()
    const malformedClient = Object.freeze({
      ...client,
      getAllKeys: async () => [PROFILE_KEY, 42] as unknown as readonly string[],
    }) satisfies AsyncStorageDurableStoreClient
    const store = createAsyncStorageDurableStore(malformedClient)

    await expect(store.readAll()).rejects.toThrow(
      "AsyncStorage returned malformed keys",
    )
  })

  it("rejects duplicate WAYVM keys", async () => {
    const { client } = createFakeAsyncStorage([[PROFILE_KEY, "manifest"]])
    const duplicateKeyClient = Object.freeze({
      ...client,
      getAllKeys: async () => [PROFILE_KEY, PROFILE_KEY],
    }) satisfies AsyncStorageDurableStoreClient
    const store = createAsyncStorageDurableStore(duplicateKeyClient)

    await expect(store.readAll()).rejects.toThrow(
      "AsyncStorage returned duplicate WAYVM keys",
    )
  })

  it("rejects missing values for enumerated keys", async () => {
    const { client } = createFakeAsyncStorage()
    const missingValueClient = Object.freeze({
      ...client,
      getAllKeys: async () => [PROFILE_KEY],
    }) satisfies AsyncStorageDurableStoreClient
    const store = createAsyncStorageDurableStore(missingValueClient)

    await expect(store.readAll()).rejects.toThrow(
      `AsyncStorage returned a missing value for ${PROFILE_KEY}`,
    )
  })

  it.each([
    {
      label: "non-array entries",
      entries: 42,
      error: "AsyncStorage returned mismatched entries",
    },
    {
      label: "mismatched entry count",
      entries: [],
      error: "AsyncStorage returned mismatched entries",
    },
    {
      label: "malformed tuple",
      entries: [[PROFILE_KEY]],
      error: "AsyncStorage returned a malformed entry",
    },
    {
      label: "non-string key",
      entries: [[42, "value"]],
      error: "AsyncStorage returned a non-string key",
    },
    {
      label: "unknown key",
      entries: [[SNAPSHOT_KEY, "value"]],
      error: `AsyncStorage returned an unknown key: ${SNAPSHOT_KEY}`,
    },
    {
      label: "non-string value",
      entries: [[PROFILE_KEY, 42]],
      error: `AsyncStorage returned a non-string value for ${PROFILE_KEY}`,
    },
  ])("rejects $label from batched reads", async ({ entries, error }) => {
    const { client } = createFakeAsyncStorage([[PROFILE_KEY, "manifest"]])
    const malformedClient = Object.freeze({
      ...client,
      multiGet: async () =>
        entries as unknown as readonly (readonly [string, string | null])[],
    }) satisfies AsyncStorageDurableStoreClient
    const store = createAsyncStorageDurableStore(malformedClient)

    await expect(store.readAll()).rejects.toThrow(error)
  })

  it("rejects duplicate keys from batched reads", async () => {
    const { client } = createFakeAsyncStorage([
      [PROFILE_KEY, "manifest"],
      [SNAPSHOT_KEY, "snapshot"],
    ])
    const duplicateEntryClient = Object.freeze({
      ...client,
      multiGet: async () =>
        [
          [PROFILE_KEY, "manifest"],
          [PROFILE_KEY, "manifest"],
        ] as const,
    }) satisfies AsyncStorageDurableStoreClient
    const store = createAsyncStorageDurableStore(duplicateEntryClient)

    await expect(store.readAll()).rejects.toThrow(
      `AsyncStorage returned a duplicate key: ${PROFILE_KEY}`,
    )
  })
})
