import { parsePersistedJson, serializePersistedJson } from "./PersistedJson"
import {
  readNonNegativeSafeInteger,
  readString,
  readTuple,
} from "./PersistenceValidation"

export const BATTLE_PROFILE_MANIFEST_FORMAT = "wayvm-manifest" as const
export const BATTLE_PROFILE_MANIFEST_VERSION = 1 as const
export const MAX_JOURNAL_RECORDS_BEFORE_CHECKPOINT = 32 as const

export type BattleProfileCheckpointSlot = "a" | "b"

export type BattleProfileManifest = {
  readonly format: typeof BATTLE_PROFILE_MANIFEST_FORMAT
  readonly version: typeof BATTLE_PROFILE_MANIFEST_VERSION
  readonly activeSlot: BattleProfileCheckpointSlot
  readonly checkpointGeneration: number
  readonly checkpointRevision: number
  readonly headGeneration: number
  readonly headRevision: number
}

export type EncodedBattleProfileManifest = readonly [
  format: string,
  version: number,
  activeSlot: string,
  checkpointGeneration: number,
  checkpointRevision: number,
  headGeneration: number,
  headRevision: number,
]

function readCheckpointSlot(value: unknown) {
  const slot = readString(value, "Manifest active checkpoint slot")
  if (slot !== "a" && slot !== "b") {
    throw new Error(`Invalid Manifest active checkpoint slot: ${slot}`)
  }

  return slot
}

export function createBattleProfileManifest({
  activeSlot,
  checkpointGeneration,
  checkpointRevision,
  headGeneration,
  headRevision,
}: Omit<BattleProfileManifest, "format" | "version">) {
  if (
    !Number.isSafeInteger(checkpointGeneration) ||
    checkpointGeneration < 0 ||
    !Number.isSafeInteger(checkpointRevision) ||
    checkpointRevision < 0 ||
    !Number.isSafeInteger(headGeneration) ||
    headGeneration < checkpointGeneration ||
    !Number.isSafeInteger(headRevision) ||
    headRevision < checkpointRevision
  ) {
    throw new Error("Invalid Battle Profile Manifest revisions")
  }

  const journalGenerationCount = headGeneration - checkpointGeneration
  const journalRevisionCount = headRevision - checkpointRevision
  if (journalGenerationCount !== journalRevisionCount) {
    throw new Error("Battle Profile Manifest journal ranges disagree")
  }
  if (journalGenerationCount >= MAX_JOURNAL_RECORDS_BEFORE_CHECKPOINT) {
    throw new Error("Battle Profile Manifest journal range is not bounded")
  }

  return Object.freeze({
    format: BATTLE_PROFILE_MANIFEST_FORMAT,
    version: BATTLE_PROFILE_MANIFEST_VERSION,
    activeSlot,
    checkpointGeneration,
    checkpointRevision,
    headGeneration,
    headRevision,
  }) satisfies BattleProfileManifest
}

export function encodeBattleProfileManifest(
  manifest: BattleProfileManifest,
): EncodedBattleProfileManifest {
  return [
    manifest.format,
    manifest.version,
    manifest.activeSlot,
    manifest.checkpointGeneration,
    manifest.checkpointRevision,
    manifest.headGeneration,
    manifest.headRevision,
  ]
}

export function serializeBattleProfileManifest(
  manifest: BattleProfileManifest,
) {
  return serializePersistedJson(encodeBattleProfileManifest(manifest))
}

export function decodeBattleProfileManifest(serialized: string) {
  const value = parsePersistedJson(serialized)
  const tuple = readTuple(value, 7, "Battle Profile Manifest")
  if (tuple[0] !== BATTLE_PROFILE_MANIFEST_FORMAT) {
    throw new Error(`Unsupported Manifest format: ${String(tuple[0])}`)
  }
  if (tuple[1] !== BATTLE_PROFILE_MANIFEST_VERSION) {
    throw new Error(`Unsupported Manifest version: ${String(tuple[1])}`)
  }

  const manifest = createBattleProfileManifest({
    activeSlot: readCheckpointSlot(tuple[2]),
    checkpointGeneration: readNonNegativeSafeInteger(
      tuple[3],
      "Manifest checkpoint generation",
    ),
    checkpointRevision: readNonNegativeSafeInteger(
      tuple[4],
      "Manifest checkpoint revision",
    ),
    headGeneration: readNonNegativeSafeInteger(
      tuple[5],
      "Manifest head generation",
    ),
    headRevision: readNonNegativeSafeInteger(
      tuple[6],
      "Manifest head revision",
    ),
  })

  if (serializeBattleProfileManifest(manifest) !== serialized) {
    throw new Error("Battle Profile Manifest encoding is not canonical")
  }

  return manifest
}
