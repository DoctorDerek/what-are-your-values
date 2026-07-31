import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import { applyAchievementTransition } from "./AchievementTransition"
import {
  decodeBattleProfileEvent,
  encodeBattleProfileEvent,
  replayBattleProfileEvent,
  type BattleProfileEvent,
  type EncodedBattleProfileEvent,
} from "./BattleProfileEvent"
import { parsePersistedJson, serializePersistedJson } from "./PersistedJson"
import {
  readIsoTimestamp,
  readNonNegativeSafeInteger,
  readString,
  readTuple,
} from "./PersistenceValidation"
import { createPlayerData, type PlayerData } from "./PlayerData"
import { createSha256Hex } from "./Sha256"

export const BATTLE_PROFILE_JOURNAL_FORMAT = "wayvm-journal-event" as const
export const BATTLE_PROFILE_JOURNAL_SCHEMA_VERSION = 1 as const

export type BattleProfilePersistenceHead = {
  readonly generation: number
  readonly revision: number
  readonly playerData: PlayerData
}

export type BattleProfileJournalRecord = {
  readonly format: typeof BATTLE_PROFILE_JOURNAL_FORMAT
  readonly journalSchemaVersion: typeof BATTLE_PROFILE_JOURNAL_SCHEMA_VERSION
  readonly expectedGeneration: number
  readonly generation: number
  readonly expectedRevision: number
  readonly revision: number
  readonly committedAt: string
  readonly event: BattleProfileEvent
  readonly contentHash: string
}

export type EncodedBattleProfileJournalRecord = readonly [
  format: string,
  journalSchemaVersion: number,
  expectedGeneration: number,
  generation: number,
  expectedRevision: number,
  revision: number,
  committedAt: string,
  event: EncodedBattleProfileEvent,
  contentHash: string,
]

type HashableBattleProfileJournalRecord = readonly [
  format: string,
  journalSchemaVersion: number,
  expectedGeneration: number,
  generation: number,
  expectedRevision: number,
  revision: number,
  committedAt: string,
  event: EncodedBattleProfileEvent,
]

function incrementSafeInteger(value: number, label: string) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value === Number.MAX_SAFE_INTEGER
  ) {
    throw new Error(`${label} cannot be incremented safely`)
  }

  return value + 1
}

function createHashableJournalRecord({
  expectedGeneration,
  generation,
  expectedRevision,
  revision,
  committedAt,
  event,
}: Omit<
  BattleProfileJournalRecord,
  "format" | "journalSchemaVersion" | "contentHash"
>): HashableBattleProfileJournalRecord {
  return [
    BATTLE_PROFILE_JOURNAL_FORMAT,
    BATTLE_PROFILE_JOURNAL_SCHEMA_VERSION,
    expectedGeneration,
    generation,
    expectedRevision,
    revision,
    committedAt,
    encodeBattleProfileEvent(event),
  ]
}

function freezeJournalRecord(
  hashableRecord: HashableBattleProfileJournalRecord,
  event: BattleProfileEvent,
  contentHash: string,
) {
  return Object.freeze({
    format: BATTLE_PROFILE_JOURNAL_FORMAT,
    journalSchemaVersion: BATTLE_PROFILE_JOURNAL_SCHEMA_VERSION,
    expectedGeneration: hashableRecord[2],
    generation: hashableRecord[3],
    expectedRevision: hashableRecord[4],
    revision: hashableRecord[5],
    committedAt: hashableRecord[6],
    event,
    contentHash,
  }) satisfies BattleProfileJournalRecord
}

function validateJournalMetadata({
  expectedGeneration,
  generation,
  expectedRevision,
  revision,
  committedAt,
}: {
  readonly expectedGeneration: unknown
  readonly generation: unknown
  readonly expectedRevision: unknown
  readonly revision: unknown
  readonly committedAt: unknown
}) {
  const validatedExpectedGeneration = readNonNegativeSafeInteger(
    expectedGeneration,
    "Journal expected generation",
  )
  const validatedGeneration = readNonNegativeSafeInteger(
    generation,
    "Journal generation",
  )
  const validatedExpectedRevision = readNonNegativeSafeInteger(
    expectedRevision,
    "Journal expected revision",
  )
  const validatedRevision = readNonNegativeSafeInteger(
    revision,
    "Journal revision",
  )

  if (validatedGeneration !== validatedExpectedGeneration + 1) {
    throw new Error("Journal generation is not contiguous")
  }
  if (validatedRevision !== validatedExpectedRevision + 1) {
    throw new Error("Journal revision is not contiguous")
  }

  return Object.freeze({
    expectedGeneration: validatedExpectedGeneration,
    generation: validatedGeneration,
    expectedRevision: validatedExpectedRevision,
    revision: validatedRevision,
    committedAt: readIsoTimestamp(committedAt, "Journal commit timestamp"),
  })
}

export function applyBattleProfileJournalRecord(
  head: BattleProfilePersistenceHead,
  record: BattleProfileJournalRecord,
) {
  if (
    head.generation !== record.expectedGeneration ||
    head.revision !== record.expectedRevision
  ) {
    throw new Error(
      "Journal record does not match the current persistence head",
    )
  }

  const resultingProfile = replayBattleProfileEvent(
    head.playerData.profile,
    record.event,
  )

  return Object.freeze({
    generation: record.generation,
    revision: record.revision,
    playerData: createPlayerData({
      ...head.playerData,
      profile: resultingProfile,
      achievements: applyAchievementTransition({
        state: head.playerData.achievements,
        priorProfile: head.playerData.profile,
        resultingProfile,
        event: record.event,
        occurredAt: record.committedAt,
      }),
    }),
  }) satisfies BattleProfilePersistenceHead
}

export async function createBattleProfileJournalCommit({
  head,
  event,
  committedAt,
}: {
  readonly head: BattleProfilePersistenceHead
  readonly event: BattleProfileEvent
  readonly committedAt: string
}) {
  const metadata = validateJournalMetadata({
    expectedGeneration: head.generation,
    generation: incrementSafeInteger(head.generation, "Journal generation"),
    expectedRevision: head.revision,
    revision: incrementSafeInteger(head.revision, "Journal revision"),
    committedAt,
  })
  const hashableRecord = createHashableJournalRecord({ ...metadata, event })
  const contentHash = await createSha256Hex(
    serializePersistedJson(hashableRecord),
  )
  const record = freezeJournalRecord(hashableRecord, event, contentHash)

  return Object.freeze({
    record,
    head: applyBattleProfileJournalRecord(head, record),
  })
}

export function encodeBattleProfileJournalRecord(
  record: BattleProfileJournalRecord,
): EncodedBattleProfileJournalRecord {
  return [...createHashableJournalRecord(record), record.contentHash]
}

export function serializeBattleProfileJournalRecord(
  record: BattleProfileJournalRecord,
) {
  return serializePersistedJson(encodeBattleProfileJournalRecord(record))
}

export async function decodeBattleProfileJournalRecord(
  activeDeck: ActiveDeck,
  serialized: string,
) {
  const value = parsePersistedJson(serialized)
  const tuple = readTuple(value, 9, "Battle Profile Journal Record")

  if (tuple[0] !== BATTLE_PROFILE_JOURNAL_FORMAT) {
    throw new Error(`Unsupported journal format: ${String(tuple[0])}`)
  }
  if (tuple[1] !== BATTLE_PROFILE_JOURNAL_SCHEMA_VERSION) {
    throw new Error(`Unsupported journal schema version: ${String(tuple[1])}`)
  }

  const metadata = validateJournalMetadata({
    expectedGeneration: tuple[2],
    generation: tuple[3],
    expectedRevision: tuple[4],
    revision: tuple[5],
    committedAt: tuple[6],
  })
  const contentHash = readString(tuple[8], "Journal content hash")
  if (!/^[0-9a-f]{64}$/.test(contentHash)) {
    throw new Error("Invalid Journal content hash")
  }

  const expectedContentHash = await createSha256Hex(
    serializePersistedJson(tuple.slice(0, 8)),
  )
  if (contentHash !== expectedContentHash) {
    throw new Error("Journal content hash does not match")
  }

  const event = decodeBattleProfileEvent(activeDeck, tuple[7])
  const record = freezeJournalRecord(
    createHashableJournalRecord({ ...metadata, event }),
    event,
    contentHash,
  )
  if (serializeBattleProfileJournalRecord(record) !== serialized) {
    throw new Error("Battle Profile Journal Record encoding is not canonical")
  }

  return record
}
