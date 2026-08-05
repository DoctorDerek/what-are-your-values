import { getAchievementDefinition } from "./AchievementCatalog"
import {
  createAchievementState,
  createInitialAchievementState,
  type AchievementState,
} from "./AchievementState"
import {
  createInitialBattleProfile,
  validateBattleProfile,
  type BattleProfile,
} from "./BattleProfile"
import { readIsoTimestamp } from "./PersistenceValidation"
import {
  createInitialPlayerSettings,
  createPlayerSettings,
  type PlayerSettings,
} from "./PlayerSettings"

export type PlayerData = {
  readonly profile: BattleProfile
  readonly achievements: AchievementState
  readonly settings: PlayerSettings
  readonly progressGenerationStartedAt: string
}

function validateAchievementTimeline(
  profile: BattleProfile,
  achievements: AchievementState,
) {
  const reachableBattleIds = [...profile.history, ...profile.redo].map(
    ({ battleId }) => battleId,
  )
  if (
    JSON.stringify(achievements.progress.countedBattleWindow.ids) !==
    JSON.stringify(reachableBattleIds)
  ) {
    throw new Error(
      "Achievement counted-battle window does not match the retained timeline",
    )
  }
}

function validateAchievementUnlockProgress(achievements: AchievementState) {
  achievements.unlocks.forEach(({ id }) => {
    const condition = getAchievementDefinition(id).condition
    if (
      condition.kind === "battleCount" &&
      achievements.progress.lifetimeBattleCount < condition.threshold
    ) {
      throw new Error(
        `Achievement unlock exceeds its lifetime battle count: ${id}`,
      )
    }
  })
}

export function createPlayerData({
  profile,
  achievements,
  settings,
  progressGenerationStartedAt,
}: PlayerData): PlayerData {
  const validatedProfile = validateBattleProfile(profile)
  const validatedAchievements = createAchievementState({
    activeDeck: validatedProfile.activeDeck,
    unlocks: achievements.unlocks,
    presentedAchievementIds: achievements.presentedAchievementIds,
    progress: achievements.progress,
  })
  const validatedSettings = createPlayerSettings(settings)

  validateAchievementTimeline(validatedProfile, validatedAchievements)
  validateAchievementUnlockProgress(validatedAchievements)

  return Object.freeze({
    profile: validatedProfile,
    achievements: validatedAchievements,
    settings: validatedSettings,
    progressGenerationStartedAt: readIsoTimestamp(
      progressGenerationStartedAt,
      "Progress generation start timestamp",
    ),
  })
}

export function createInitialPlayerData({
  schedulerSeed,
  createdAt,
}: {
  readonly schedulerSeed: string
  readonly createdAt: string
}) {
  const profile = createInitialBattleProfile(schedulerSeed)

  return createPlayerData({
    profile,
    achievements: createInitialAchievementState(profile.activeDeck),
    settings: createInitialPlayerSettings(),
    progressGenerationStartedAt: createdAt,
  })
}
