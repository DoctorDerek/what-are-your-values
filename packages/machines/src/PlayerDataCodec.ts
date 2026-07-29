import {
  decodeAchievementState,
  encodeAchievementState,
  type EncodedAchievementState,
} from "./AchievementStateCodec"
import {
  decodeBattleProfile,
  encodeBattleProfile,
  type EncodedBattleProfile,
} from "./BattleProfileCodec"
import { readIsoTimestamp, readTuple } from "./PersistenceValidation"
import { createPlayerData, type PlayerData } from "./PlayerData"
import {
  decodePlayerSettings,
  encodePlayerSettings,
  type EncodedPlayerSettings,
} from "./PlayerSettings"

export const PLAYER_DATA_CODEC_VERSION = 1 as const

export type EncodedPlayerData = readonly [
  version: number,
  profile: EncodedBattleProfile,
  achievements: EncodedAchievementState,
  settings: EncodedPlayerSettings,
  progressGenerationStartedAt: string,
]

export function encodePlayerData(playerData: PlayerData): EncodedPlayerData {
  const validated = createPlayerData(playerData)

  return [
    PLAYER_DATA_CODEC_VERSION,
    encodeBattleProfile(validated.profile),
    encodeAchievementState(validated.achievements),
    encodePlayerSettings(validated.settings),
    validated.progressGenerationStartedAt,
  ]
}

export function decodePlayerData(value: unknown) {
  const tuple = readTuple(value, 5, "Player Data")
  if (tuple[0] !== PLAYER_DATA_CODEC_VERSION) {
    throw new Error(
      `Unsupported Player Data codec version: ${String(tuple[0])}`,
    )
  }

  const profile = decodeBattleProfile(tuple[1])
  const playerData = createPlayerData({
    profile,
    achievements: decodeAchievementState(profile.activeDeck, tuple[2]),
    settings: decodePlayerSettings(tuple[3]),
    progressGenerationStartedAt: readIsoTimestamp(
      tuple[4],
      "Progress generation start timestamp",
    ),
  })

  if (JSON.stringify(encodePlayerData(playerData)) !== JSON.stringify(value)) {
    throw new Error("Player Data encoding is not canonical")
  }

  return playerData
}
