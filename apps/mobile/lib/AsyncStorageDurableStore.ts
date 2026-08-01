import {
  DurableStoreConflictError,
  validateDurableStoreTransaction,
  type DurableStoreAdapter,
  type DurableStoreTransaction,
} from "@game/machines/src/DurableStoreAdapter"

const WAYVM_DURABLE_STORE_KEY_PREFIX = "wayvm."

export type AsyncStorageDurableStoreClient = {
  readonly getAllKeys: () => Promise<readonly string[]>
  readonly multiGet: (
    keys: readonly string[],
  ) => Promise<readonly (readonly [string, string | null])[]>
  readonly multiSet: (
    keyValuePairs: readonly (readonly [string, string])[],
  ) => Promise<void>
  readonly multiRemove: (keys: readonly string[]) => Promise<void>
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}

function validateOwnedKeys(keys: readonly string[], label: string) {
  if (keys.some((key) => !key.startsWith(WAYVM_DURABLE_STORE_KEY_PREFIX))) {
    throw new Error(`${label} contains a key outside the WAYVM namespace`)
  }
}

function validateAsyncStorageTransaction(transaction: DurableStoreTransaction) {
  validateDurableStoreTransaction(transaction)
  validateOwnedKeys(
    transaction.expectedEntries.map(([key]) => key),
    "Durable store expectations",
  )
  validateOwnedKeys(
    transaction.putEntries.map(([key]) => key),
    "Durable store writes",
  )
  validateOwnedKeys(transaction.deleteKeys, "Durable store deletes")
}

async function readRequestedEntries(
  storage: AsyncStorageDurableStoreClient,
  requestedKeys: readonly string[],
) {
  validateOwnedKeys(requestedKeys, "AsyncStorage reads")
  if (requestedKeys.length === 0) {
    return new Map<string, string | null>()
  }

  const rawEntries: unknown = await storage.multiGet(requestedKeys)
  if (
    !isUnknownArray(rawEntries) ||
    rawEntries.length !== requestedKeys.length
  ) {
    throw new Error("AsyncStorage returned mismatched entries")
  }

  const requestedKeySet = new Set(requestedKeys)
  const entries = new Map<string, string | null>()

  rawEntries.forEach((rawEntry) => {
    if (!isUnknownArray(rawEntry) || rawEntry.length !== 2) {
      throw new Error("AsyncStorage returned a malformed entry")
    }

    const [key, value] = rawEntry
    if (typeof key !== "string") {
      throw new Error("AsyncStorage returned a non-string key")
    }
    if (!requestedKeySet.has(key)) {
      throw new Error(`AsyncStorage returned an unknown key: ${key}`)
    }
    if (entries.has(key)) {
      throw new Error(`AsyncStorage returned a duplicate key: ${key}`)
    }
    if (typeof value !== "string" && value !== null) {
      throw new Error(`AsyncStorage returned a non-string value for ${key}`)
    }

    entries.set(key, value)
  })

  return entries
}

async function readAllOwnedEntries(storage: AsyncStorageDurableStoreClient) {
  const rawKeys: unknown = await storage.getAllKeys()
  if (
    !isUnknownArray(rawKeys) ||
    rawKeys.some((key) => typeof key !== "string")
  ) {
    throw new Error("AsyncStorage returned malformed keys")
  }

  const ownedKeys = rawKeys.filter(
    (key): key is string =>
      typeof key === "string" && key.startsWith(WAYVM_DURABLE_STORE_KEY_PREFIX),
  )
  if (new Set(ownedKeys).size !== ownedKeys.length) {
    throw new Error("AsyncStorage returned duplicate WAYVM keys")
  }

  const entries = await readRequestedEntries(storage, ownedKeys)
  const durableEntries = new Map<string, string>()
  entries.forEach((value, key) => {
    if (value === null) {
      throw new Error(`AsyncStorage returned a missing value for ${key}`)
    }

    durableEntries.set(key, value)
  })
  return durableEntries
}

async function compareAndSwapOwnedEntries(
  storage: AsyncStorageDurableStoreClient,
  transaction: DurableStoreTransaction,
) {
  validateAsyncStorageTransaction(transaction)

  const expectedEntries = await readRequestedEntries(
    storage,
    transaction.expectedEntries.map(([key]) => key),
  )
  transaction.expectedEntries.forEach(([key, expectedValue]) => {
    if (expectedEntries.get(key) !== expectedValue) {
      throw new DurableStoreConflictError(key)
    }
  })

  if (transaction.putEntries.length > 0) {
    await storage.multiSet(transaction.putEntries)
  }
  if (transaction.deleteKeys.length > 0) {
    await storage.multiRemove(transaction.deleteKeys)
  }

  const verificationEntries = await readRequestedEntries(storage, [
    ...transaction.putEntries.map(([key]) => key),
    ...transaction.deleteKeys,
  ])
  transaction.putEntries.forEach(([key, value]) => {
    if (verificationEntries.get(key) !== value) {
      throw new Error(`Durable store write verification failed for ${key}`)
    }
  })
  transaction.deleteKeys.forEach((key) => {
    if (verificationEntries.get(key) !== null) {
      throw new Error(`Durable store delete verification failed for ${key}`)
    }
  })
}

export function createAsyncStorageDurableStore(
  storage: AsyncStorageDurableStoreClient,
) {
  let operationTail = Promise.resolve()

  function enqueueOperation<Result>(operation: () => Promise<Result>) {
    const queuedOperation = operationTail.then(operation)
    operationTail = queuedOperation.then(
      () => undefined,
      () => undefined,
    )
    return queuedOperation
  }

  return Object.freeze({
    readAll: () => enqueueOperation(() => readAllOwnedEntries(storage)),
    compareAndSwapVerified: (transaction) =>
      enqueueOperation(() => compareAndSwapOwnedEntries(storage, transaction)),
  }) satisfies DurableStoreAdapter
}
