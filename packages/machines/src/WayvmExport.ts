import { CANONICAL_CATALOG_VERSION } from "@game/data/src/Value"
import { BATTLE_PROFILE_CHECKPOINT_SCHEMA_VERSION } from "./BattleProfileCheckpoint"
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

export const WAYVM_EXPORT_FORMAT = "wayvm-export" as const
export const WAYVM_EXPORT_FORMAT_VERSION = 1 as const
export const MAX_EXPORT_METADATA_STRING_LENGTH = 256 as const

export type WayvmExport = {
  readonly format: typeof WAYVM_EXPORT_FORMAT
  readonly exportFormatVersion: typeof WAYVM_EXPORT_FORMAT_VERSION
  readonly exportedAt: string
  readonly sourceAppVersion: string
  readonly sourceBuild: string
  readonly saveSchemaVersion: typeof BATTLE_PROFILE_CHECKPOINT_SCHEMA_VERSION
  readonly canonicalCatalogVersion: typeof CANONICAL_CATALOG_VERSION
  readonly activeDeckFingerprint: string
  readonly deckRevision: number
  readonly progressGeneration: number
  readonly playerData: PlayerData
  readonly contentHash: string
}

export type EncodedWayvmExport = readonly [
  format: string,
  exportFormatVersion: number,
  exportedAt: string,
  sourceAppVersion: string,
  sourceBuild: string,
  saveSchemaVersion: number,
  canonicalCatalogVersion: string,
  activeDeckFingerprint: string,
  deckRevision: number,
  progressGeneration: number,
  playerData: EncodedPlayerData,
  contentHash: string,
]

type HashableWayvmExport = readonly [
  format: string,
  exportFormatVersion: number,
  exportedAt: string,
  sourceAppVersion: string,
  sourceBuild: string,
  saveSchemaVersion: number,
  canonicalCatalogVersion: string,
  activeDeckFingerprint: string,
  deckRevision: number,
  progressGeneration: number,
  playerData: EncodedPlayerData,
]

function readRequiredMetadata(value: unknown, label: string) {
  const metadata = readString(value, label)
  if (
    metadata.length === 0 ||
    metadata.length > MAX_EXPORT_METADATA_STRING_LENGTH
  ) {
    throw new Error(`Invalid ${label}`)
  }

  return metadata
}

function createHashableWayvmExport({
  exportedAt,
  sourceAppVersion,
  sourceBuild,
  playerData,
}: {
  readonly exportedAt: string
  readonly sourceAppVersion: string
  readonly sourceBuild: string
  readonly playerData: PlayerData
}): HashableWayvmExport {
  return [
    WAYVM_EXPORT_FORMAT,
    WAYVM_EXPORT_FORMAT_VERSION,
    readIsoTimestamp(exportedAt, "Export timestamp"),
    readRequiredMetadata(sourceAppVersion, "source application version"),
    readRequiredMetadata(sourceBuild, "source build"),
    BATTLE_PROFILE_CHECKPOINT_SCHEMA_VERSION,
    CANONICAL_CATALOG_VERSION,
    playerData.profile.activeDeck.fingerprint,
    playerData.profile.scheduler.deckRevision,
    playerData.profile.scheduler.progressGeneration,
    encodePlayerData(playerData),
  ]
}

function freezeWayvmExport(
  hashableExport: HashableWayvmExport,
  playerData: PlayerData,
  contentHash: string,
) {
  return Object.freeze({
    format: WAYVM_EXPORT_FORMAT,
    exportFormatVersion: WAYVM_EXPORT_FORMAT_VERSION,
    exportedAt: hashableExport[2],
    sourceAppVersion: hashableExport[3],
    sourceBuild: hashableExport[4],
    saveSchemaVersion: BATTLE_PROFILE_CHECKPOINT_SCHEMA_VERSION,
    canonicalCatalogVersion: CANONICAL_CATALOG_VERSION,
    activeDeckFingerprint: hashableExport[7],
    deckRevision: hashableExport[8],
    progressGeneration: hashableExport[9],
    playerData,
    contentHash,
  }) satisfies WayvmExport
}

export async function createWayvmExport({
  exportedAt,
  sourceAppVersion,
  sourceBuild,
  playerData,
}: {
  readonly exportedAt: string
  readonly sourceAppVersion: string
  readonly sourceBuild: string
  readonly playerData: PlayerData
}) {
  const validatedPlayerData = decodePlayerData(encodePlayerData(playerData))
  const hashableExport = createHashableWayvmExport({
    exportedAt,
    sourceAppVersion,
    sourceBuild,
    playerData: validatedPlayerData,
  })
  const contentHash = await createSha256Hex(
    serializePersistedJson(hashableExport),
  )

  return freezeWayvmExport(hashableExport, validatedPlayerData, contentHash)
}

export function encodeWayvmExport(
  wayvmExport: WayvmExport,
): EncodedWayvmExport {
  return [...createHashableWayvmExport(wayvmExport), wayvmExport.contentHash]
}

export function serializeWayvmExport(wayvmExport: WayvmExport) {
  return serializePersistedJson(encodeWayvmExport(wayvmExport))
}

export async function decodeWayvmExport(serialized: string) {
  const value = parsePersistedJson(serialized)
  const tuple = readTuple(value, 12, "WAYVM Export")

  if (tuple[0] !== WAYVM_EXPORT_FORMAT) {
    throw new Error(`Unsupported export format: ${String(tuple[0])}`)
  }
  if (tuple[1] !== WAYVM_EXPORT_FORMAT_VERSION) {
    throw new Error(`Unsupported export format version: ${String(tuple[1])}`)
  }
  if (tuple[5] !== BATTLE_PROFILE_CHECKPOINT_SCHEMA_VERSION) {
    throw new Error(`Unsupported save schema version: ${String(tuple[5])}`)
  }
  if (tuple[6] !== CANONICAL_CATALOG_VERSION) {
    throw new Error(
      `Unsupported canonical catalog version: ${String(tuple[6])}`,
    )
  }

  const exportedAt = readIsoTimestamp(tuple[2], "Export timestamp")
  const sourceAppVersion = readRequiredMetadata(
    tuple[3],
    "source application version",
  )
  const sourceBuild = readRequiredMetadata(tuple[4], "source build")
  const activeDeckFingerprint = readString(
    tuple[7],
    "Export Active Deck fingerprint",
  )
  const deckRevision = readNonNegativeSafeInteger(
    tuple[8],
    "Export deck revision",
  )
  const progressGeneration = readNonNegativeSafeInteger(
    tuple[9],
    "Export progress generation",
  )
  const contentHash = readString(tuple[11], "Export content hash")
  if (!/^[0-9a-f]{64}$/.test(contentHash)) {
    throw new Error("Invalid Export content hash")
  }

  const expectedContentHash = await createSha256Hex(
    serializePersistedJson(tuple.slice(0, 11)),
  )
  if (contentHash !== expectedContentHash) {
    throw new Error("Export content hash does not match")
  }

  const playerData = decodePlayerData(tuple[10])
  if (
    activeDeckFingerprint !== playerData.profile.activeDeck.fingerprint ||
    deckRevision !== playerData.profile.scheduler.deckRevision ||
    progressGeneration !== playerData.profile.scheduler.progressGeneration
  ) {
    throw new Error("Export identity does not match its player data")
  }

  const wayvmExport = freezeWayvmExport(
    createHashableWayvmExport({
      exportedAt,
      sourceAppVersion,
      sourceBuild,
      playerData,
    }),
    playerData,
    contentHash,
  )
  if (serializeWayvmExport(wayvmExport) !== serialized) {
    throw new Error("WAYVM Export encoding is not canonical")
  }

  return wayvmExport
}

export function createWayvmExportFilename(exportedAt: string) {
  const timestamp = readIsoTimestamp(exportedAt, "Export timestamp")
  return `what-are-your-values-mapache-backup-${timestamp
    .replace("T", "-")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/u, "Z")}.json`
}
