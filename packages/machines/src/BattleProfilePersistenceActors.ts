import { fromPromise } from "xstate"
import type { BattleProfile } from "./BattleProfile"
import type { BattleProfileEvent } from "./BattleProfileEvent"
import { hydrateBattleProfileStore } from "./BattleProfileHydration"
import {
  commitBattleProfileStoreEvent,
  initializeBattleProfileStore,
  type BattleProfileStoreState,
} from "./BattleProfileStore"
import type { DurableStoreAdapter } from "./DurableStoreAdapter"

type HydrateBattleProfileInput = {
  readonly store: DurableStoreAdapter
  readonly appVersion: string
}

type InitializeBattleProfileInput = HydrateBattleProfileInput & {
  readonly profile: BattleProfile
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
      profile: input.profile,
      createdAt: input.createdAt,
      appVersion: input.appVersion,
    }),
)

export const commitBattleProfileEventActor = fromPromise(
  async ({ input }: { input: CommitBattleProfileEventInput }) =>
    commitBattleProfileStoreEvent(input),
)
