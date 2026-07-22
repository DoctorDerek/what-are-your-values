import type { BattleProfile } from "./BattleProfile"
import {
  createBattleProfileCheckpoint,
  serializeBattleProfileCheckpoint,
} from "./BattleProfileCheckpoint"
import type { BattleProfilePersistenceHead } from "./BattleProfileJournal"
import {
  createBattleProfileManifest,
  serializeBattleProfileManifest,
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

function freezeBattleProfileStoreState(
  state: BattleProfileStoreState,
): BattleProfileStoreState {
  return Object.freeze({
    ...state,
    journalKeys: Object.freeze([...state.journalKeys]),
  })
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

  return freezeBattleProfileStoreState({
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
