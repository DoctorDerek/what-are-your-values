import { getErrorMessage } from "@game/utils/src/Errors"
import { decodeBattleProfileCheckpoint } from "./BattleProfileCheckpoint"
import { replayBattleProfileJournalToGeneration } from "./BattleProfileJournalReplay"
import { decodeBattleProfileManifest } from "./BattleProfileManifest"
import { recoverBattleProfileStore } from "./BattleProfileRecovery"
import {
  BATTLE_PROFILE_JOURNAL_KEY_PREFIX,
  BATTLE_PROFILE_MANIFEST_KEY,
  BATTLE_PROFILE_QUARANTINE_KEY,
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
  BATTLE_PROFILE_SNAPSHOT_B_KEY,
  createBattleProfileStoreState,
  getSortedBattleProfileJournalKeys,
  type BattleProfileStoreState,
} from "./BattleProfileStore"
import type { DurableStoreAdapter } from "./DurableStoreAdapter"

export type BattleProfileHydrationResult =
  | { readonly status: "empty" }
  | {
      readonly status: "ready"
      readonly state: BattleProfileStoreState
      readonly recoveryNotice?: string
    }
  | {
      readonly status: "recovery-required"
      readonly issue: string
      readonly entries: ReadonlyMap<string, string>
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

    const journalKeys = getSortedBattleProfileJournalKeys(entries).map(
      ({ key }) => key,
    )
    const head = await replayBattleProfileJournalToGeneration({
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
    const cleanHydrationIssue = getErrorMessage(error)

    try {
      return await recoverBattleProfileStore({
        store,
        entries,
        appVersion,
        cleanHydrationIssue,
      })
    } catch (recoveryError: unknown) {
      return Object.freeze({
        status: "recovery-required",
        issue: `${cleanHydrationIssue}; ${getErrorMessage(recoveryError)}`,
        entries: new Map(entries),
      })
    }
  }
}
