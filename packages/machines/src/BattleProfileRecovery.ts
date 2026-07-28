import {
  createBattleProfileCheckpoint,
  decodeBattleProfileCheckpoint,
  serializeBattleProfileCheckpoint,
  type BattleProfileCheckpoint,
} from "./BattleProfileCheckpoint"
import { replayAvailableBattleProfileJournal } from "./BattleProfileJournalReplay"
import {
  createBattleProfileManifest,
  MAX_JOURNAL_RECORDS_BEFORE_CHECKPOINT,
  serializeBattleProfileManifest,
  type BattleProfileCheckpointSlot,
} from "./BattleProfileManifest"
import {
  BATTLE_PROFILE_MANIFEST_KEY,
  BATTLE_PROFILE_QUARANTINE_KEY,
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
  BATTLE_PROFILE_SNAPSHOT_B_KEY,
  createBattleProfileStoreState,
  getSortedBattleProfileJournalKeys,
} from "./BattleProfileStore"
import type {
  DurableStoreAdapter,
  DurableStoreEntry,
  DurableStoreExpectation,
} from "./DurableStoreAdapter"
import { MAX_PERSISTED_JSON_BYTES } from "./PersistedJson"

type CheckpointCandidate = {
  readonly slot: BattleProfileCheckpointSlot
  readonly checkpoint: BattleProfileCheckpoint
}

function getSnapshotKey(slot: BattleProfileCheckpointSlot) {
  return slot === "a"
    ? BATTLE_PROFILE_SNAPSHOT_A_KEY
    : BATTLE_PROFILE_SNAPSHOT_B_KEY
}

async function decodeCheckpointCandidates(
  entries: ReadonlyMap<string, string>,
) {
  const candidates: CheckpointCandidate[] = []

  for (const slot of ["a", "b"] as const) {
    const key = getSnapshotKey(slot)
    const bytes = entries.get(key)
    if (!bytes) {
      continue
    }

    try {
      candidates.push({
        slot,
        checkpoint: await decodeBattleProfileCheckpoint(bytes),
      })
    } catch {
      continue
    }
  }

  return candidates
}

function createRecoveryNotice(cleanHydrationIssue: string) {
  return `Recovered the latest contiguous Battle Profile after: ${cleanHydrationIssue}`
}

export async function recoverBattleProfileStore({
  store,
  entries,
  appVersion,
  cleanHydrationIssue,
}: {
  readonly store: DurableStoreAdapter
  readonly entries: ReadonlyMap<string, string>
  readonly appVersion: string
  readonly cleanHydrationIssue: string
}) {
  const checkpointCandidates = await decodeCheckpointCandidates(entries)
  if (checkpointCandidates.length === 0) {
    throw new Error("Both Battle Profile checkpoint slots are unreadable")
  }

  const journalEntries = getSortedBattleProfileJournalKeys(entries)
  const maximumRetainedJournalRecords =
    MAX_JOURNAL_RECORDS_BEFORE_CHECKPOINT * 2 - 1
  if (journalEntries.length > maximumRetainedJournalRecords) {
    throw new Error("Battle Profile journal retention is unbounded")
  }
  const maximumGeneration =
    journalEntries.at(-1)?.generation ??
    Math.max(
      ...checkpointCandidates.map(({ checkpoint }) => checkpoint.generation),
    )
  const replayedCandidates = await Promise.all(
    checkpointCandidates.map(async (candidate) => ({
      candidate,
      replay: await replayAvailableBattleProfileJournal({
        entries,
        checkpoint: candidate.checkpoint,
        maximumGeneration,
      }),
    })),
  )
  replayedCandidates.sort(
    (first, second) =>
      second.replay.head.generation - first.replay.head.generation ||
      Number(Boolean(first.replay.stoppedIssue)) -
        Number(Boolean(second.replay.stoppedIssue)) ||
      second.candidate.checkpoint.generation -
        first.candidate.checkpoint.generation,
  )
  const selected = replayedCandidates[0]
  if (!selected) {
    throw new Error("No recoverable Battle Profile checkpoint exists")
  }
  if (selected.replay.stoppedIssue) {
    throw new Error(selected.replay.stoppedIssue)
  }

  const journalKeys = journalEntries.map(({ key }) => key)
  const journalDistance =
    selected.replay.head.generation - selected.candidate.checkpoint.generation
  const currentManifestBytes = entries.get(BATTLE_PROFILE_MANIFEST_KEY) ?? null

  if (journalDistance < MAX_JOURNAL_RECORDS_BEFORE_CHECKPOINT) {
    const manifest = createBattleProfileManifest({
      activeSlot: selected.candidate.slot,
      checkpointGeneration: selected.candidate.checkpoint.generation,
      checkpointRevision: selected.candidate.checkpoint.revision,
      headGeneration: selected.replay.head.generation,
      headRevision: selected.replay.head.revision,
    })
    const manifestBytes = serializeBattleProfileManifest(manifest)

    await store.compareAndSwapVerified({
      expectedEntries: [[BATTLE_PROFILE_MANIFEST_KEY, currentManifestBytes]],
      putEntries: [[BATTLE_PROFILE_MANIFEST_KEY, manifestBytes]],
      deleteKeys: [],
    })

    return Object.freeze({
      status: "ready" as const,
      recoveryNotice: createRecoveryNotice(cleanHydrationIssue),
      state: createBattleProfileStoreState({
        head: selected.replay.head,
        manifest,
        manifestBytes,
        profileCreatedAt: selected.candidate.checkpoint.createdAt,
        appVersion,
        journalKeys,
      }),
    })
  }

  const recoveredSlot = selected.candidate.slot === "a" ? "b" : "a"
  const recoveredCheckpointKey = getSnapshotKey(recoveredSlot)
  const replacedCheckpointBytes = entries.get(recoveredCheckpointKey) ?? null
  const replacedCheckpointIsValid = checkpointCandidates.some(
    ({ slot }) => slot === recoveredSlot,
  )
  const quarantineBytes = replacedCheckpointIsValid
    ? null
    : replacedCheckpointBytes
  if (
    quarantineBytes &&
    new TextEncoder().encode(quarantineBytes).byteLength >
      MAX_PERSISTED_JSON_BYTES
  ) {
    throw new Error("Unreadable checkpoint exceeds the quarantine byte limit")
  }
  if (quarantineBytes && entries.has(BATTLE_PROFILE_QUARANTINE_KEY)) {
    throw new Error("Existing quarantine must be exported or discarded first")
  }

  const checkpoint = await createBattleProfileCheckpoint({
    generation: selected.replay.head.generation,
    revision: selected.replay.head.revision,
    createdAt: selected.candidate.checkpoint.createdAt,
    updatedAt: selected.replay.updatedAt,
    appVersion,
    profile: selected.replay.head.profile,
  })
  const manifest = createBattleProfileManifest({
    activeSlot: recoveredSlot,
    checkpointGeneration: checkpoint.generation,
    checkpointRevision: checkpoint.revision,
    headGeneration: checkpoint.generation,
    headRevision: checkpoint.revision,
  })
  const manifestBytes = serializeBattleProfileManifest(manifest)
  const expectedEntries: DurableStoreExpectation[] = [
    [BATTLE_PROFILE_MANIFEST_KEY, currentManifestBytes],
    [recoveredCheckpointKey, replacedCheckpointBytes],
  ]
  const putEntries: DurableStoreEntry[] = [
    [recoveredCheckpointKey, serializeBattleProfileCheckpoint(checkpoint)],
    [BATTLE_PROFILE_MANIFEST_KEY, manifestBytes],
  ]
  if (quarantineBytes) {
    expectedEntries.push([BATTLE_PROFILE_QUARANTINE_KEY, null])
    putEntries.push([BATTLE_PROFILE_QUARANTINE_KEY, quarantineBytes])
  }

  await store.compareAndSwapVerified({
    expectedEntries,
    putEntries,
    deleteKeys: [],
  })

  return Object.freeze({
    status: "ready" as const,
    recoveryNotice: createRecoveryNotice(cleanHydrationIssue),
    state: createBattleProfileStoreState({
      head: selected.replay.head,
      manifest,
      manifestBytes,
      profileCreatedAt: selected.candidate.checkpoint.createdAt,
      appVersion,
      journalKeys,
    }),
  })
}
