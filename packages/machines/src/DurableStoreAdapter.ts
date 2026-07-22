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

export class DurableStoreConflictError extends Error {
  constructor(key: string) {
    super(`Durable store expectation failed for ${key}`)
    this.name = "DurableStoreConflictError"
  }
}
