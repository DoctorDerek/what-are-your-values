import { fromPromise } from "xstate"
import {
  deleteAllBattleProfileStoreData,
  replaceBattleProfileStorePlayerDataForLocalMutation,
  type BattleProfileStoreState,
} from "./BattleProfileStore"
import type { DurableStoreAdapter } from "./DurableStoreAdapter"
import {
  createScopedPlayerDataResetCandidate,
  type ScopedPlayerDataResetKind,
} from "./PlayerDataReset"

type ApplyScopedPlayerDataResetInput = {
  readonly store: DurableStoreAdapter
  readonly state: BattleProfileStoreState
  readonly resetKind: ScopedPlayerDataResetKind
  readonly resetAt: string
}

type DeleteAllPlayerDataInput = {
  readonly store: DurableStoreAdapter
  readonly state: BattleProfileStoreState
}

export const applyScopedPlayerDataResetActor = fromPromise(
  async ({ input }: { input: ApplyScopedPlayerDataResetInput }) =>
    replaceBattleProfileStorePlayerDataForLocalMutation({
      store: input.store,
      state: input.state,
      playerData: createScopedPlayerDataResetCandidate({
        playerData: input.state.head.playerData,
        resetAt: input.resetAt,
        resetKind: input.resetKind,
      }),
      replacedAt: input.resetAt,
    }),
)

export const deleteAllPlayerDataActor = fromPromise(
  async ({ input }: { input: DeleteAllPlayerDataInput }) =>
    deleteAllBattleProfileStoreData(input),
)
