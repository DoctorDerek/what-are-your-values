import type { ActiveDeck } from "@game/data/src/ActiveDeck"

export function readTuple(value: unknown, length: number, label: string) {
  if (!Array.isArray(value) || value.length !== length) {
    throw new Error(`Invalid ${label}`)
  }

  return value as readonly unknown[]
}

export function readString(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new Error(`Invalid ${label}`)
  }

  return value
}

export function readBoolean(value: unknown, label: string) {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${label}`)
  }

  return value
}

export function readIsoTimestamp(value: unknown, label: string) {
  const timestamp = readString(value, label)
  const parsedTimestamp = new Date(timestamp)

  if (
    !Number.isFinite(parsedTimestamp.getTime()) ||
    parsedTimestamp.toISOString() !== timestamp
  ) {
    throw new Error(`Invalid ${label}: ${timestamp}`)
  }

  return timestamp
}

export function readNonNegativeSafeInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`Invalid ${label}: ${String(value)}`)
  }

  return value as number
}

export function readPositiveSafeInteger(value: unknown, label: string) {
  const integer = readNonNegativeSafeInteger(value, label)
  if (integer < 1) {
    throw new Error(`Invalid ${label}: ${integer}`)
  }

  return integer
}

export function readActiveValueId(
  activeDeck: ActiveDeck,
  value: unknown,
  label: string,
) {
  const candidate = readString(value, label)
  const valueId = activeDeck.valueIds.find(
    (activeValueId) => activeValueId === candidate,
  )
  if (!valueId) {
    throw new Error(`${label} is not in the Active Deck: ${candidate}`)
  }

  return valueId
}
