import {
  DurableStoreConflictError,
  type DurableStoreAdapter,
  type DurableStoreEntry,
  type DurableStoreTransaction,
} from "./DurableStoreAdapter"

function validateUniqueKeys(keys: readonly string[], label: string) {
  if (keys.some((key) => key.length === 0)) {
    throw new Error(`${label} contains an empty key`)
  }
  if (new Set(keys).size !== keys.length) {
    throw new Error(`${label} contains duplicate keys`)
  }
}

function validateTransaction(transaction: DurableStoreTransaction) {
  const expectedKeys = transaction.expectedEntries.map(([key]) => key)
  const putKeys = transaction.putEntries.map(([key]) => key)

  validateUniqueKeys(expectedKeys, "Durable store expectations")
  validateUniqueKeys(putKeys, "Durable store writes")
  validateUniqueKeys(transaction.deleteKeys, "Durable store deletes")

  const deleteKeySet = new Set(transaction.deleteKeys)
  if (putKeys.some((key) => deleteKeySet.has(key))) {
    throw new Error("Durable store transaction writes and deletes the same key")
  }
}

export function createInMemoryDurableStore(
  initialEntries: readonly DurableStoreEntry[] = [],
) {
  validateUniqueKeys(
    initialEntries.map(([key]) => key),
    "Initial durable store entries",
  )
  let entries = new Map(initialEntries)

  return Object.freeze({
    readAll: async () => new Map(entries),
    compareAndSwapVerified: async (transaction) => {
      validateTransaction(transaction)

      transaction.expectedEntries.forEach(([key, expectedValue]) => {
        if ((entries.get(key) ?? null) !== expectedValue) {
          throw new DurableStoreConflictError(key)
        }
      })

      const candidate = new Map(entries)
      transaction.putEntries.forEach(([key, value]) => {
        candidate.set(key, value)
      })
      transaction.deleteKeys.forEach((key) => {
        candidate.delete(key)
      })
      transaction.putEntries.forEach(([key, value]) => {
        if (candidate.get(key) !== value) {
          throw new Error(`Durable store write verification failed for ${key}`)
        }
      })

      entries = candidate
    },
  }) satisfies DurableStoreAdapter
}
