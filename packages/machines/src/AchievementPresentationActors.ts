import { fromPromise } from "xstate"
import type { AchievementId } from "./AchievementCatalog"
import { markAchievementPresented } from "./AchievementState"
import {
  replaceBattleProfileStorePlayerDataForLocalMutation,
  type BattleProfileStoreState,
} from "./BattleProfileStore"
import type { DurableStoreAdapter } from "./DurableStoreAdapter"
import { createPlayerData } from "./PlayerData"

type RecordAchievementPresentationInput = {
  readonly store: DurableStoreAdapter
  readonly state: BattleProfileStoreState
  readonly achievementId: AchievementId
  readonly presentedAt: string
}

export const recordAchievementPresentationActor = fromPromise(
  async ({ input }: { input: RecordAchievementPresentationInput }) => {
    const currentPlayerData = input.state.head.playerData
    const achievements = markAchievementPresented({
      activeDeck: currentPlayerData.profile.activeDeck,
      state: currentPlayerData.achievements,
      achievementId: input.achievementId,
    })
    if (achievements === currentPlayerData.achievements) {
      return input.state
    }

    return replaceBattleProfileStorePlayerDataForLocalMutation({
      store: input.store,
      state: input.state,
      playerData: createPlayerData({
        ...currentPlayerData,
        achievements,
      }),
      replacedAt: input.presentedAt,
    })
  },
)
