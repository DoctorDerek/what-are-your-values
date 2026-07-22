import {
  decodeBattleProfileCheckpoint,
  type BattleProfileCheckpoint,
} from "./BattleProfileCheckpoint"
import {
  applyBattleProfileJournalRecord,
  decodeBattleProfileJournalRecord,
  type BattleProfilePersistenceHead,
} from "./BattleProfileJournal"
import { decodeBattleProfileManifest } from "./BattleProfileManifest"
import {
  BATTLE_PROFILE_JOURNAL_KEY_PREFIX,
  BATTLE_PROFILE_MANIFEST_KEY,
  BATTLE_PROFILE_QUARANTINE_KEY,
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
  BATTLE_PROFILE_SNAPSHOT_B_KEY,
  createBattleProfileStoreState,
  readBattleProfileJournalKeyGeneration,
  type BattleProfileStoreState,
} from "./BattleProfileStore"
import type { DurableStoreAdapter } from "./DurableStoreAdapter"

export type BattleProfileHydrationResult =
  | { readonly status: "empty" }
  | { readonly status: "ready"; readonly state: BattleProfileStoreState }
  | {
      readonly status: "recovery-required"
      readonly issue: string
      readonly entries: ReadonlyMap<string, string>
    }

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function hasBattleProfileRecords(entries: ReadonlyMap<string, string>) {
  return Array.from(entries.keys()).some(
    (key) =>
      key === BATTLE_PROFILE_MANIFEST_KEY ||
      key === BATTLE_PROFILE_SNAPSHOT_A_KEY ||
      key === BATTLE_PROFILE_SNAPSHOT_B_KEY ||
      key === BATTLE_PROFILE_QUARANTINE_KEY ||
      key.startsWith(BATTLE_PROFILE_JOURNAL_KEY_PREFIX),
  )
}

function getSortedJournalKeys(entries: ReadonlyMap<string, string>) {
  return Array.from(entries.keys())
    .filter((key) => key.startsWith(BATTLE_PROFILE_JOURNAL_KEY_PREFIX))
    .map((key) => ({
      key,
      generation: readBattleProfileJournalKeyGeneration(key),
    }))
    .sort((first, second) => first.generation - second.generation)
}

function createCheckpointHead(
  checkpoint: BattleProfileCheckpoint,
): BattleProfilePersistenceHead {
  return Object.freeze({
    generation: checkpoint.generation,
    revision: checkpoint.revision,
    profile: checkpoint.profile,
  })
}

async function replayManifestJournal({
  entries,
  checkpoint,
  headGeneration,
}: {
  readonly entries: ReadonlyMap<string, string>
  readonly checkpoint: BattleProfileCheckpoint
  readonly headGeneration: number
}) {
  let head = createCheckpointHead(checkpoint)

  for (
    let generation = checkpoint.generation + 1;
    generation <= headGeneration;
    generation += 1
  ) {
    const key = `${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}${generation}`
    const serialized = entries.get(key)
    if (!serialized) {
      throw new Error(
        `Battle Profile journal generation ${generation} is missing`,
      )
    }

    const record = await decodeBattleProfileJournalRecord(
      head.profile.activeDeck,
      serialized,
    )
    if (record.generation !== generation) {
      throw new Error(
        `Battle Profile journal key disagrees at generation ${generation}`,
      )
    }
    head = applyBattleProfileJournalRecord(head, record)
  }

  return head
}

export async function hydrateBattleProfileStore({
  store,
  appVersion,
}: {
  readonly store: DurableStoreAdapter
  readonly appVersion: string
}): Promise<BattleProfileHydrationResult> {
  const entries = await store.readAll()
  if (!hasBattleProfileRecords(entries)) {
    return Object.freeze({ status: "empty" })
  }

  try {
    const manifestBytes = entries.get(BATTLE_PROFILE_MANIFEST_KEY)
    if (!manifestBytes) {
      throw new Error("Battle Profile manifest is missing")
    }
    const manifest = decodeBattleProfileManifest(manifestBytes)
    const checkpointKey =
      manifest.activeSlot === "a"
        ? BATTLE_PROFILE_SNAPSHOT_A_KEY
        : BATTLE_PROFILE_SNAPSHOT_B_KEY
    const checkpointBytes = entries.get(checkpointKey)
    if (!checkpointBytes) {
      throw new Error("Active Battle Profile checkpoint is missing")
    }
    const checkpoint = await decodeBattleProfileCheckpoint(checkpointBytes)
    if (
      checkpoint.generation !== manifest.checkpointGeneration ||
      checkpoint.revision !== manifest.checkpointRevision
    ) {
      throw new Error("Active checkpoint does not match the manifest")
    }

    const journalKeys = getSortedJournalKeys(entries).map(({ key }) => key)
    const head = await replayManifestJournal({
      entries,
      checkpoint,
      headGeneration: manifest.headGeneration,
    })
    if (
      head.generation !== manifest.headGeneration ||
      head.revision !== manifest.headRevision
    ) {
      throw new Error(
        "Replayed Battle Profile head does not match the manifest",
      )
    }

    return Object.freeze({
      status: "ready",
      state: createBattleProfileStoreState({
        head,
        manifest,
        manifestBytes,
        profileCreatedAt: checkpoint.createdAt,
        appVersion,
        journalKeys,
      }),
    })
  } catch (error: unknown) {
    return Object.freeze({
      status: "recovery-required",
      issue: getErrorMessage(error),
      entries: new Map(entries),
    })
  }
}
