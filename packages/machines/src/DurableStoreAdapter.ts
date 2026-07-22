export type DurableStoreEntry = readonly [key: string, value: string]
export type DurableStoreExpectation = readonly [
  key: string,
  value: string | null,
]

export type DurableStoreTransaction = {
  readonly expectedEntries: readonly DurableStoreExpectation[]
  readonly putEntries: readonly DurableStoreEntry[]
  readonly deleteKeys: readonly string[]
}

export type DurableStoreAdapter = {
  readonly readAll: () => Promise<ReadonlyMap<string, string>>
  readonly compareAndSwapVerified: (
    transaction: DurableStoreTransaction,
  ) => Promise<void>
}

function validateUniqueKeys(keys: readonly string[], label: string) {
  if (keys.some((key) => key.length === 0)) {
    throw new Error(`${label} contains an empty key`)
  }
  if (new Set(keys).size !== keys.length) {
    throw new Error(`${label} contains duplicate keys`)
  }
}

export function validateDurableStoreTransaction(
  transaction: DurableStoreTransaction,
) {
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

export class DurableStoreConflictError extends Error {
  constructor(key: string) {
    super(`Durable store expectation failed for ${key}`)
    this.name = "DurableStoreConflictError"
  }
}
