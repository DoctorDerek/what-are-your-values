import { fromPromise } from "xstate"
import type { BattleProfileEvent } from "./BattleProfileEvent"
import { hydrateBattleProfileStore } from "./BattleProfileHydration"
import {
  commitBattleProfileStoreEvent,
  initializeBattleProfileStore,
  type BattleProfileStoreState,
} from "./BattleProfileStore"
import type { DurableStoreAdapter } from "./DurableStoreAdapter"
import type { PlayerData } from "./PlayerData"

type HydrateBattleProfileInput = {
  readonly store: DurableStoreAdapter
  readonly appVersion: string
}

type InitializeBattleProfileInput = HydrateBattleProfileInput & {
  readonly playerData: PlayerData
  readonly createdAt: string
}

type CommitBattleProfileEventInput = {
  readonly store: DurableStoreAdapter
  readonly state: BattleProfileStoreState
  readonly event: BattleProfileEvent
  readonly committedAt: string
}

export const hydrateBattleProfileActor = fromPromise(
  async ({ input }: { input: HydrateBattleProfileInput }) =>
    hydrateBattleProfileStore(input),
)

export const initializeBattleProfileActor = fromPromise(
  async ({ input }: { input: InitializeBattleProfileInput }) =>
    initializeBattleProfileStore({
      store: input.store,
      playerData: input.playerData,
      createdAt: input.createdAt,
      appVersion: input.appVersion,
    }),
)

export const commitBattleProfileEventActor = fromPromise(
  async ({ input }: { input: CommitBattleProfileEventInput }) =>
    commitBattleProfileStoreEvent(input),
)
