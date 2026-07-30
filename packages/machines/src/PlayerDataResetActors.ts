import { fromPromise } from "xstate"
import {
  deleteAllBattleProfileStoreData,
  replaceBattleProfileStorePlayerDataForReset,
  type BattleProfileStoreState,
} from "./BattleProfileStore"
import type { DurableStoreAdapter } from "./DurableStoreAdapter"
import type { PlayerData } from "./PlayerData"
import {
  createScopedPlayerDataResetCandidate,
  type ScopedPlayerDataResetKind,
} from "./PlayerDataReset"

type ApplyScopedPlayerDataResetInput = {
  readonly store: DurableStoreAdapter
  readonly state: BattleProfileStoreState
  readonly playerData: PlayerData
  readonly resetKind: ScopedPlayerDataResetKind
  readonly resetAt: string
}

type DeleteAllPlayerDataInput = {
  readonly store: DurableStoreAdapter
  readonly state: BattleProfileStoreState
}

export const applyScopedPlayerDataResetActor = fromPromise(
  async ({ input }: { input: ApplyScopedPlayerDataResetInput }) =>
    replaceBattleProfileStorePlayerDataForReset({
      store: input.store,
      state: input.state,
      playerData: createScopedPlayerDataResetCandidate(input),
      replacedAt: input.resetAt,
    }),
)

export const deleteAllPlayerDataActor = fromPromise(
  async ({ input }: { input: DeleteAllPlayerDataInput }) =>
    deleteAllBattleProfileStoreData(input),
)
