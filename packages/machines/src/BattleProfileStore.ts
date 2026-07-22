import type { BattleProfile } from "./BattleProfile"
import {
  createBattleProfileCheckpoint,
  serializeBattleProfileCheckpoint,
} from "./BattleProfileCheckpoint"
import type { BattleProfileEvent } from "./BattleProfileEvent"
import {
  createBattleProfileJournalCommit,
  serializeBattleProfileJournalRecord,
  type BattleProfilePersistenceHead,
} from "./BattleProfileJournal"
import {
  createBattleProfileManifest,
  MAX_JOURNAL_RECORDS_BEFORE_CHECKPOINT,
  serializeBattleProfileManifest,
  type BattleProfileCheckpointSlot,
  type BattleProfileManifest,
} from "./BattleProfileManifest"
import type { DurableStoreAdapter } from "./DurableStoreAdapter"

export const BATTLE_PROFILE_SNAPSHOT_A_KEY = "wayvm.snapshot.a" as const
export const BATTLE_PROFILE_SNAPSHOT_B_KEY = "wayvm.snapshot.b" as const
export const BATTLE_PROFILE_MANIFEST_KEY = "wayvm.snapshot.manifest" as const
export const BATTLE_PROFILE_JOURNAL_KEY_PREFIX = "wayvm.journal." as const
export const BATTLE_PROFILE_QUARANTINE_KEY =
  "wayvm.recovery.quarantine" as const

export type BattleProfileStoreState = {
  readonly head: BattleProfilePersistenceHead
  readonly manifest: BattleProfileManifest
  readonly manifestBytes: string
  readonly profileCreatedAt: string
  readonly appVersion: string
  readonly journalKeys: readonly string[]
}

export function createBattleProfileStoreState(
  state: BattleProfileStoreState,
): BattleProfileStoreState {
  return Object.freeze({
    ...state,
    journalKeys: Object.freeze([...state.journalKeys]),
  })
}

function getSnapshotKey(slot: BattleProfileCheckpointSlot) {
  return slot === "a"
    ? BATTLE_PROFILE_SNAPSHOT_A_KEY
    : BATTLE_PROFILE_SNAPSHOT_B_KEY
}

function getInactiveCheckpointSlot(
  activeSlot: BattleProfileCheckpointSlot,
): BattleProfileCheckpointSlot {
  return activeSlot === "a" ? "b" : "a"
}

export function getBattleProfileJournalKey(generation: number) {
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error(`Invalid Battle Profile journal generation: ${generation}`)
  }

  return `${BATTLE_PROFILE_JOURNAL_KEY_PREFIX}${generation}`
}

export function readBattleProfileJournalKeyGeneration(key: string) {
  if (!key.startsWith(BATTLE_PROFILE_JOURNAL_KEY_PREFIX)) {
    throw new Error(`Invalid Battle Profile journal key: ${key}`)
  }

  const generationText = key.slice(BATTLE_PROFILE_JOURNAL_KEY_PREFIX.length)
  const generation = Number(generationText)
  if (
    !Number.isSafeInteger(generation) ||
    generation < 1 ||
    String(generation) !== generationText
  ) {
    throw new Error(`Invalid Battle Profile journal key: ${key}`)
  }

  return generation
}

export function getSortedBattleProfileJournalKeys(
  entries: ReadonlyMap<string, string>,
) {
  return Array.from(entries.keys())
    .filter((key) => key.startsWith(BATTLE_PROFILE_JOURNAL_KEY_PREFIX))
    .map((key) => ({
      key,
      generation: readBattleProfileJournalKeyGeneration(key),
    }))
    .sort((first, second) => first.generation - second.generation)
}

export async function initializeBattleProfileStore({
  store,
  profile,
  createdAt,
  appVersion,
}: {
  readonly store: DurableStoreAdapter
  readonly profile: BattleProfile
  readonly createdAt: string
  readonly appVersion: string
}) {
  const checkpoint = await createBattleProfileCheckpoint({
    generation: 0,
    revision: 0,
    createdAt,
    updatedAt: createdAt,
    appVersion,
    profile,
  })
  const manifest = createBattleProfileManifest({
    activeSlot: "a",
    checkpointGeneration: 0,
    checkpointRevision: 0,
    headGeneration: 0,
    headRevision: 0,
  })
  const checkpointBytes = serializeBattleProfileCheckpoint(checkpoint)
  const manifestBytes = serializeBattleProfileManifest(manifest)

  await store.compareAndSwapVerified({
    expectedEntries: [
      [BATTLE_PROFILE_MANIFEST_KEY, null],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, null],
      [BATTLE_PROFILE_SNAPSHOT_B_KEY, null],
    ],
    putEntries: [
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, checkpointBytes],
      [BATTLE_PROFILE_MANIFEST_KEY, manifestBytes],
    ],
    deleteKeys: [],
  })

  return createBattleProfileStoreState({
    head: Object.freeze({
      generation: 0,
      revision: 0,
      profile: checkpoint.profile,
    }),
    manifest,
    manifestBytes,
    profileCreatedAt: createdAt,
    appVersion,
    journalKeys: [],
  })
}

export async function commitBattleProfileStoreEvent({
  store,
  state,
  event,
  committedAt,
}: {
  readonly store: DurableStoreAdapter
  readonly state: BattleProfileStoreState
  readonly event: BattleProfileEvent
  readonly committedAt: string
}) {
  const commit = await createBattleProfileJournalCommit({
    head: state.head,
    event,
    committedAt,
  })
  const journalKey = getBattleProfileJournalKey(commit.head.generation)
  const journalBytes = serializeBattleProfileJournalRecord(commit.record)
  const journalCount =
    commit.head.generation - state.manifest.checkpointGeneration

  if (journalCount < MAX_JOURNAL_RECORDS_BEFORE_CHECKPOINT) {
    const manifest = createBattleProfileManifest({
      activeSlot: state.manifest.activeSlot,
      checkpointGeneration: state.manifest.checkpointGeneration,
      checkpointRevision: state.manifest.checkpointRevision,
      headGeneration: commit.head.generation,
      headRevision: commit.head.revision,
    })
    const manifestBytes = serializeBattleProfileManifest(manifest)

    await store.compareAndSwapVerified({
      expectedEntries: [
        [BATTLE_PROFILE_MANIFEST_KEY, state.manifestBytes],
        [journalKey, null],
      ],
      putEntries: [
        [journalKey, journalBytes],
        [BATTLE_PROFILE_MANIFEST_KEY, manifestBytes],
      ],
      deleteKeys: [],
    })

    return createBattleProfileStoreState({
      ...state,
      head: commit.head,
      manifest,
      manifestBytes,
      journalKeys: [...state.journalKeys, journalKey],
    })
  }

  if (journalCount !== MAX_JOURNAL_RECORDS_BEFORE_CHECKPOINT) {
    throw new Error(`Unexpected Battle Profile journal count: ${journalCount}`)
  }

  const activeSlot = getInactiveCheckpointSlot(state.manifest.activeSlot)
  const checkpoint = await createBattleProfileCheckpoint({
    generation: commit.head.generation,
    revision: commit.head.revision,
    createdAt: state.profileCreatedAt,
    updatedAt: committedAt,
    appVersion: state.appVersion,
    profile: commit.head.profile,
  })
  const manifest = createBattleProfileManifest({
    activeSlot,
    checkpointGeneration: commit.head.generation,
    checkpointRevision: commit.head.revision,
    headGeneration: commit.head.generation,
    headRevision: commit.head.revision,
  })
  const manifestBytes = serializeBattleProfileManifest(manifest)
  const retainedJournalKeys = [...state.journalKeys, journalKey].filter(
    (key) =>
      readBattleProfileJournalKeyGeneration(key) >
      state.manifest.checkpointGeneration,
  )
  const retainedJournalKeySet = new Set(retainedJournalKeys)
  const deleteKeys = state.journalKeys.filter(
    (key) => !retainedJournalKeySet.has(key),
  )

  await store.compareAndSwapVerified({
    expectedEntries: [
      [BATTLE_PROFILE_MANIFEST_KEY, state.manifestBytes],
      [journalKey, null],
    ],
    putEntries: [
      [journalKey, journalBytes],
      [
        getSnapshotKey(activeSlot),
        serializeBattleProfileCheckpoint(checkpoint),
      ],
      [BATTLE_PROFILE_MANIFEST_KEY, manifestBytes],
    ],
    deleteKeys,
  })

  return createBattleProfileStoreState({
    ...state,
    head: commit.head,
    manifest,
    manifestBytes,
    journalKeys: retainedJournalKeys,
  })
}
