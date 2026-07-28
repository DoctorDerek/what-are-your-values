import {
  DurableStoreConflictError,
  validateDurableStoreTransaction,
  type DurableStoreAdapter,
  type DurableStoreTransaction,
} from "@game/machines/src/DurableStoreAdapter"

const BATTLE_PROFILE_DATABASE_NAME = "what-are-your-values-mapache"
const BATTLE_PROFILE_DATABASE_VERSION = 1
const BATTLE_PROFILE_OBJECT_STORE_NAME = "battle-profile"

function openBattleProfileDatabase(indexedDb: IDBFactory) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    let isBlocked = false
    const request = indexedDb.open(
      BATTLE_PROFILE_DATABASE_NAME,
      BATTLE_PROFILE_DATABASE_VERSION,
    )

    request.onupgradeneeded = () => {
      if (
        !request.result.objectStoreNames.contains(
          BATTLE_PROFILE_OBJECT_STORE_NAME,
        )
      ) {
        request.result.createObjectStore(BATTLE_PROFILE_OBJECT_STORE_NAME)
      }
    }
    request.onsuccess = () => {
      if (isBlocked) {
        request.result.close()
        return
      }

      resolve(request.result)
    }
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open durable storage"))
    request.onblocked = () => {
      isBlocked = true
      reject(new Error("Durable storage upgrade is blocked"))
    }
  })
}

async function readAllDatabaseEntries(indexedDb: IDBFactory) {
  const database = await openBattleProfileDatabase(indexedDb)

  try {
    return await new Promise<ReadonlyMap<string, string>>((resolve, reject) => {
      const transaction = database.transaction(
        BATTLE_PROFILE_OBJECT_STORE_NAME,
        "readonly",
      )
      const objectStore = transaction.objectStore(
        BATTLE_PROFILE_OBJECT_STORE_NAME,
      )
      const keysRequest = objectStore.getAllKeys()
      const valuesRequest = objectStore.getAll()

      transaction.oncomplete = () => {
        try {
          if (keysRequest.result.length !== valuesRequest.result.length) {
            throw new Error("Durable storage returned mismatched entries")
          }

          const entries = keysRequest.result.map((key, index) => {
            const value: unknown = valuesRequest.result[index]
            if (typeof key !== "string" || typeof value !== "string") {
              throw new Error("Durable storage contains a non-string entry")
            }

            return [key, value] as const
          })
          resolve(new Map(entries))
        } catch (error: unknown) {
          reject(error)
        }
      }
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Unable to read durable storage"))
      transaction.onabort = () =>
        reject(
          transaction.error ?? new Error("Durable storage read was aborted"),
        )
    })
  } finally {
    database.close()
  }
}

async function compareAndSwapDatabaseEntries(
  indexedDb: IDBFactory,
  durableStoreTransaction: DurableStoreTransaction,
) {
  validateDurableStoreTransaction(durableStoreTransaction)
  const database = await openBattleProfileDatabase(indexedDb)

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        BATTLE_PROFILE_OBJECT_STORE_NAME,
        "readwrite",
      )
      const objectStore = transaction.objectStore(
        BATTLE_PROFILE_OBJECT_STORE_NAME,
      )
      let failure: Error | null = null
      let pendingExpectationCount =
        durableStoreTransaction.expectedEntries.length

      const abortWithFailure = (error: Error) => {
        if (failure) {
          return
        }

        failure = error
        transaction.abort()
      }

      const queueVerifiedMutations = () => {
        durableStoreTransaction.putEntries.forEach(([key, value]) => {
          objectStore.put(value, key)
        })
        durableStoreTransaction.deleteKeys.forEach((key) => {
          objectStore.delete(key)
        })
        durableStoreTransaction.putEntries.forEach(([key, value]) => {
          const request = objectStore.get(key)
          request.onsuccess = () => {
            if (request.result !== value) {
              abortWithFailure(
                new Error(`Durable store write verification failed for ${key}`),
              )
            }
          }
        })
        durableStoreTransaction.deleteKeys.forEach((key) => {
          const request = objectStore.get(key)
          request.onsuccess = () => {
            if (request.result !== undefined) {
              abortWithFailure(
                new Error(
                  `Durable store delete verification failed for ${key}`,
                ),
              )
            }
          }
        })
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => {
        failure ??=
          transaction.error ?? new Error("Unable to update durable storage")
      }
      transaction.onabort = () =>
        reject(
          failure ??
            transaction.error ??
            new Error("Durable storage update was aborted"),
        )

      durableStoreTransaction.expectedEntries.forEach(
        ([key, expectedValue]) => {
          const request = objectStore.get(key)
          request.onsuccess = () => {
            if (failure) {
              return
            }

            const actualValue =
              request.result === undefined ? null : request.result
            if (actualValue !== expectedValue) {
              abortWithFailure(new DurableStoreConflictError(key))
              return
            }

            pendingExpectationCount -= 1
            if (pendingExpectationCount === 0) {
              queueVerifiedMutations()
            }
          }
        },
      )

      if (pendingExpectationCount === 0) {
        queueVerifiedMutations()
      }
    })
  } finally {
    database.close()
  }
}

export function createIndexedDbDurableStore(
  getIndexedDb: () => IDBFactory = () => globalThis.indexedDB,
) {
  return Object.freeze({
    readAll: () => readAllDatabaseEntries(getIndexedDb()),
    compareAndSwapVerified: (transaction) =>
      compareAndSwapDatabaseEntries(getIndexedDb(), transaction),
  }) satisfies DurableStoreAdapter
}
