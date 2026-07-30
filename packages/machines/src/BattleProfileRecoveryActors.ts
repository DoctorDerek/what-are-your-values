import { fromPromise } from "xstate"
import { createBattleProfileRecoveryBundle } from "./BattleProfileRecoveryBundle"
import {
  deleteUnrecoverableBattleProfileStoreData,
  replaceUnrecoverableBattleProfileStorePlayerData,
} from "./BattleProfileStore"
import type { DurableStoreAdapter } from "./DurableStoreAdapter"
import type { PlayerData } from "./PlayerData"

type CreateRecoveryBundleInput = {
  readonly entries: ReadonlyMap<string, string>
  readonly exportedAt: string
  readonly issue: string
  readonly sourceAppVersion: string
  readonly sourceBuild: string
}

type ReplaceUnrecoverablePlayerDataInput = {
  readonly store: DurableStoreAdapter
  readonly entries: ReadonlyMap<string, string>
  readonly playerData: PlayerData
  readonly replacedAt: string
  readonly appVersion: string
}

type DeleteUnrecoverablePlayerDataInput = {
  readonly store: DurableStoreAdapter
  readonly entries: ReadonlyMap<string, string>
}

export const createRecoveryBundleActor = fromPromise(
  async ({ input }: { input: CreateRecoveryBundleInput }) =>
    createBattleProfileRecoveryBundle(input),
)

export const replaceUnrecoverablePlayerDataActor = fromPromise(
  async ({ input }: { input: ReplaceUnrecoverablePlayerDataInput }) =>
    replaceUnrecoverableBattleProfileStorePlayerData(input),
)

export const deleteUnrecoverablePlayerDataActor = fromPromise(
  async ({ input }: { input: DeleteUnrecoverablePlayerDataInput }) =>
    deleteUnrecoverableBattleProfileStoreData(input),
)
