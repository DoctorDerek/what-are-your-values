import { fromPromise } from "xstate"
import {
  replaceBattleProfileStorePlayerDataForLocalMutation,
  type BattleProfileStoreState,
} from "./BattleProfileStore"
import type { DurableStoreAdapter } from "./DurableStoreAdapter"
import { createPlayerData } from "./PlayerData"
import { createPlayerSettings, type PlayerSettings } from "./PlayerSettings"

type UpdatePlayerSettingsInput = {
  readonly store: DurableStoreAdapter
  readonly state: BattleProfileStoreState
  readonly settings: PlayerSettings
  readonly updatedAt: string
}

function arePlayerSettingsEqual(first: PlayerSettings, second: PlayerSettings) {
  return (
    first.locale === second.locale &&
    first.reducedMotion === second.reducedMotion &&
    first.controlHints === second.controlHints
  )
}

export const updatePlayerSettingsActor = fromPromise(
  async ({ input }: { input: UpdatePlayerSettingsInput }) => {
    const settings = createPlayerSettings(input.settings)
    const currentPlayerData = input.state.head.playerData
    if (arePlayerSettingsEqual(currentPlayerData.settings, settings))
      return input.state

    return replaceBattleProfileStorePlayerDataForLocalMutation({
      store: input.store,
      state: input.state,
      playerData: createPlayerData({
        ...currentPlayerData,
        settings,
      }),
      replacedAt: input.updatedAt,
    })
  },
)
