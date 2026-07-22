import {
  DurableStoreConflictError,
  validateDurableStoreTransaction,
  type DurableStoreAdapter,
  type DurableStoreEntry,
} from "./DurableStoreAdapter"

export function createInMemoryDurableStore(
  initialEntries: readonly DurableStoreEntry[] = [],
) {
  validateDurableStoreTransaction({
    expectedEntries: initialEntries.map(([key]) => [key, null]),
    putEntries: [],
    deleteKeys: [],
  })
  let entries = new Map(initialEntries)

  return Object.freeze({
    readAll: async () => new Map(entries),
    compareAndSwapVerified: async (transaction) => {
      validateDurableStoreTransaction(transaction)

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
