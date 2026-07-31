import { CANONICAL_CATALOG_VERSION } from "@game/data/src/Value"
import { parsePersistedJson, serializePersistedJson } from "./PersistedJson"
import {
  readIsoTimestamp,
  readNonNegativeSafeInteger,
  readString,
  readTuple,
} from "./PersistenceValidation"
import type { PlayerData } from "./PlayerData"
import {
  decodePlayerData,
  encodePlayerData,
  type EncodedPlayerData,
} from "./PlayerDataCodec"
import { createSha256Hex } from "./Sha256"

export const BATTLE_PROFILE_CHECKPOINT_FORMAT = "wayvm-save" as const
export const BATTLE_PROFILE_CHECKPOINT_SCHEMA_VERSION = 1 as const

export type BattleProfileCheckpoint = {
  readonly format: typeof BATTLE_PROFILE_CHECKPOINT_FORMAT
  readonly schemaVersion: typeof BATTLE_PROFILE_CHECKPOINT_SCHEMA_VERSION
  readonly generation: number
  readonly revision: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly appVersion: string
  readonly canonicalCatalogVersion: typeof CANONICAL_CATALOG_VERSION
  readonly playerData: PlayerData
  readonly contentHash: string
}

export type EncodedBattleProfileCheckpoint = readonly [
  format: string,
  schemaVersion: number,
  generation: number,
  revision: number,
  createdAt: string,
  updatedAt: string,
  appVersion: string,
  canonicalCatalogVersion: string,
  playerData: EncodedPlayerData,
  contentHash: string,
]

type HashableBattleProfileCheckpoint = readonly [
  format: string,
  schemaVersion: number,
  generation: number,
  revision: number,
  createdAt: string,
  updatedAt: string,
  appVersion: string,
  canonicalCatalogVersion: string,
  playerData: EncodedPlayerData,
]

function createHashableCheckpoint({
  generation,
  revision,
  createdAt,
  updatedAt,
  appVersion,
  playerData,
}: Omit<
  BattleProfileCheckpoint,
  "format" | "schemaVersion" | "canonicalCatalogVersion" | "contentHash"
>): HashableBattleProfileCheckpoint {
  return [
    BATTLE_PROFILE_CHECKPOINT_FORMAT,
    BATTLE_PROFILE_CHECKPOINT_SCHEMA_VERSION,
    generation,
    revision,
    createdAt,
    updatedAt,
    appVersion,
    playerData.profile.activeDeck.catalogVersion,
    encodePlayerData(playerData),
  ]
}

function freezeCheckpoint(
  hashableCheckpoint: HashableBattleProfileCheckpoint,
  playerData: PlayerData,
  contentHash: string,
) {
  return Object.freeze({
    format: BATTLE_PROFILE_CHECKPOINT_FORMAT,
    schemaVersion: BATTLE_PROFILE_CHECKPOINT_SCHEMA_VERSION,
    generation: hashableCheckpoint[2],
    revision: hashableCheckpoint[3],
    createdAt: hashableCheckpoint[4],
    updatedAt: hashableCheckpoint[5],
    appVersion: hashableCheckpoint[6],
    canonicalCatalogVersion: CANONICAL_CATALOG_VERSION,
    playerData,
    contentHash,
  }) satisfies BattleProfileCheckpoint
}

function validateCheckpointMetadata({
  generation,
  revision,
  createdAt,
  updatedAt,
  appVersion,
}: {
  readonly generation: unknown
  readonly revision: unknown
  readonly createdAt: unknown
  readonly updatedAt: unknown
  readonly appVersion: unknown
}) {
  const validatedCreatedAt = readIsoTimestamp(
    createdAt,
    "Checkpoint created at",
  )
  const validatedUpdatedAt = readIsoTimestamp(
    updatedAt,
    "Checkpoint updated at",
  )
  const validatedAppVersion = readString(appVersion, "Checkpoint app version")

  if (validatedUpdatedAt < validatedCreatedAt) {
    throw new Error(
      "Checkpoint update timestamp precedes its creation timestamp",
    )
  }
  if (validatedAppVersion.length === 0) {
    throw new Error("Checkpoint app version is required")
  }

  return Object.freeze({
    generation: readNonNegativeSafeInteger(generation, "Checkpoint generation"),
    revision: readNonNegativeSafeInteger(revision, "Checkpoint revision"),
    createdAt: validatedCreatedAt,
    updatedAt: validatedUpdatedAt,
    appVersion: validatedAppVersion,
  })
}

export async function createBattleProfileCheckpoint({
  generation,
  revision,
  createdAt,
  updatedAt,
  appVersion,
  playerData,
}: {
  readonly generation: number
  readonly revision: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly appVersion: string
  readonly playerData: PlayerData
}) {
  const metadata = validateCheckpointMetadata({
    generation,
    revision,
    createdAt,
    updatedAt,
    appVersion,
  })
  const validatedPlayerData = decodePlayerData(encodePlayerData(playerData))
  const hashableCheckpoint = createHashableCheckpoint({
    ...metadata,
    playerData: validatedPlayerData,
  })
  const contentHash = await createSha256Hex(
    serializePersistedJson(hashableCheckpoint),
  )

  return freezeCheckpoint(hashableCheckpoint, validatedPlayerData, contentHash)
}

export function encodeBattleProfileCheckpoint(
  checkpoint: BattleProfileCheckpoint,
): EncodedBattleProfileCheckpoint {
  return [...createHashableCheckpoint(checkpoint), checkpoint.contentHash]
}

export function serializeBattleProfileCheckpoint(
  checkpoint: BattleProfileCheckpoint,
) {
  return serializePersistedJson(encodeBattleProfileCheckpoint(checkpoint))
}

export async function decodeBattleProfileCheckpoint(serialized: string) {
  const value = parsePersistedJson(serialized)
  const tuple = readTuple(value, 10, "Battle Profile Checkpoint")

  if (tuple[0] !== BATTLE_PROFILE_CHECKPOINT_FORMAT) {
    throw new Error(`Unsupported checkpoint format: ${String(tuple[0])}`)
  }
  if (tuple[1] !== BATTLE_PROFILE_CHECKPOINT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported checkpoint schema version: ${String(tuple[1])}`,
    )
  }
  if (tuple[7] !== CANONICAL_CATALOG_VERSION) {
    throw new Error(
      `Unsupported checkpoint catalog version: ${String(tuple[7])}`,
    )
  }

  const metadata = validateCheckpointMetadata({
    generation: tuple[2],
    revision: tuple[3],
    createdAt: tuple[4],
    updatedAt: tuple[5],
    appVersion: tuple[6],
  })
  const contentHash = readString(tuple[9], "Checkpoint content hash")
  if (!/^[0-9a-f]{64}$/.test(contentHash)) {
    throw new Error("Invalid Checkpoint content hash")
  }

  const expectedContentHash = await createSha256Hex(
    serializePersistedJson(tuple.slice(0, 9)),
  )
  if (contentHash !== expectedContentHash) {
    throw new Error("Checkpoint content hash does not match")
  }

  const playerData = decodePlayerData(tuple[8])
  const checkpoint = freezeCheckpoint(
    createHashableCheckpoint({ ...metadata, playerData }),
    playerData,
    contentHash,
  )

  if (serializeBattleProfileCheckpoint(checkpoint) !== serialized) {
    throw new Error("Battle Profile Checkpoint encoding is not canonical")
  }

  return checkpoint
}
