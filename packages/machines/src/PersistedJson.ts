export const MAX_PERSISTED_JSON_BYTES = 8 * 1024 * 1024
export const MAX_PERSISTED_JSON_DEPTH = 32 as const
export const MAX_PERSISTED_JSON_CONTAINER_NODES = 50_000 as const

type StructuralCandidate = {
  readonly value: unknown
  readonly depth: number
}

function validatePersistedJsonStructure(value: unknown) {
  const candidates: StructuralCandidate[] = [{ value, depth: 0 }]
  let containerNodeCount = 0

  while (candidates.length > 0) {
    const candidate = candidates.pop()
    if (!candidate) {
      throw new Error("Persisted JSON structural validation failed")
    }

    if (typeof candidate.value === "number") {
      if (!Number.isSafeInteger(candidate.value)) {
        throw new Error("Persisted JSON contains an unsafe number")
      }
      continue
    }
    if (Array.isArray(candidate.value)) {
      const depth = candidate.depth + 1
      if (depth > MAX_PERSISTED_JSON_DEPTH) {
        throw new Error("Persisted JSON exceeds its structural depth limit")
      }

      containerNodeCount += 1
      if (containerNodeCount > MAX_PERSISTED_JSON_CONTAINER_NODES) {
        throw new Error("Persisted JSON exceeds its container node limit")
      }

      candidate.value.forEach((nestedValue) => {
        candidates.push({ value: nestedValue, depth })
      })
      continue
    }
    if (candidate.value !== null && typeof candidate.value === "object") {
      throw new Error(
        "Persisted JSON must use tuple arrays rather than objects",
      )
    }
  }

  return value
}

export function parsePersistedJson(serialized: string) {
  if (
    new TextEncoder().encode(serialized).byteLength > MAX_PERSISTED_JSON_BYTES
  ) {
    throw new Error("Persisted JSON exceeds its byte limit")
  }

  let value: unknown
  try {
    value = JSON.parse(serialized) as unknown
  } catch {
    throw new Error("Persisted JSON is malformed")
  }

  return validatePersistedJsonStructure(value)
}

export function serializePersistedJson(value: unknown) {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) {
    throw new Error("Persisted value is not JSON serializable")
  }

  parsePersistedJson(serialized)
  return serialized
}
