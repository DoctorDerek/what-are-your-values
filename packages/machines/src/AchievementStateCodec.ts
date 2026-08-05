import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import { readAchievementId, type AchievementId } from "./AchievementCatalog"
import {
  COUNTED_BATTLE_WINDOW_CAPACITY,
  createAchievementState,
  type AchievementState,
  type AchievementUnlock,
} from "./AchievementState"
import type { BattleId } from "./BattleIdentity"
import { readBattleId } from "./BattleIdentity"
import {
  readBoolean,
  readIsoTimestamp,
  readNonNegativeSafeInteger,
  readString,
  readTuple,
} from "./PersistenceValidation"
import {
  decodeCompleteValueNumberMap,
  encodeValueNumberEntries,
  type EncodedValueNumberEntry,
} from "./ValueNumberMapCodec"

export const ACHIEVEMENT_STATE_CODEC_VERSION = 1 as const

type EncodedAchievementUnlock = readonly [
  id: string,
  unlockedAt: string,
  eventToken: string,
]

type EncodedAchievementProgress = readonly [
  achievementProgressGeneration: number,
  lifetimeBattleCount: number,
  baselineLevelsByValue: readonly EncodedValueNumberEntry[],
  topFiveAlreadyRevealedAtReset: boolean,
  countedBattleWindow: readonly string[],
]

export type EncodedAchievementState = readonly [
  version: number,
  unlocks: readonly EncodedAchievementUnlock[],
  presentedAchievementIds: readonly string[],
  progress: EncodedAchievementProgress,
]

function encodeAchievementUnlock(
  unlock: AchievementUnlock,
): EncodedAchievementUnlock {
  return [unlock.id, unlock.unlockedAt, unlock.eventToken]
}

export function encodeAchievementState(
  state: AchievementState,
): EncodedAchievementState {
  return [
    ACHIEVEMENT_STATE_CODEC_VERSION,
    state.unlocks.map(encodeAchievementUnlock),
    state.presentedAchievementIds,
    [
      state.progress.achievementProgressGeneration,
      state.progress.lifetimeBattleCount,
      encodeValueNumberEntries(state.progress.baselineLevelsByValue),
      state.progress.topFiveAlreadyRevealedAtReset,
      state.progress.countedBattleWindow.ids,
    ],
  ]
}

function decodeAchievementUnlock(value: unknown, index: number) {
  const label = `Achievement Unlock ${index}`
  const tuple = readTuple(value, 3, label)

  return Object.freeze({
    id: readAchievementId(tuple[0], `${label} ID`),
    unlockedAt: readIsoTimestamp(tuple[1], `${label} timestamp`),
    eventToken: readString(tuple[2], `${label} event token`),
  }) satisfies AchievementUnlock
}

function decodeAchievementUnlocks(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("Invalid Achievement Unlocks")
  }

  return value.map(decodeAchievementUnlock)
}

function decodePresentedAchievementIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("Invalid Presented Achievement IDs")
  }

  return value.map((id, index) =>
    readAchievementId(id, `Presented Achievement ID ${index}`),
  ) satisfies AchievementId[]
}

function decodeCountedBattleWindow(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("Invalid Counted Battle window")
  }

  return value.map((battleId, index) =>
    readBattleId(battleId, `Counted Battle ID ${index}`),
  ) satisfies BattleId[]
}

export function decodeAchievementState(activeDeck: ActiveDeck, value: unknown) {
  const tuple = readTuple(value, 4, "Achievement State")
  if (tuple[0] !== ACHIEVEMENT_STATE_CODEC_VERSION) {
    throw new Error(
      `Unsupported Achievement State codec version: ${String(tuple[0])}`,
    )
  }

  const progressTuple = readTuple(tuple[3], 5, "Achievement Progress")
  const state = createAchievementState({
    activeDeck,
    unlocks: decodeAchievementUnlocks(tuple[1]),
    presentedAchievementIds: decodePresentedAchievementIds(tuple[2]),
    progress: {
      achievementProgressGeneration: readNonNegativeSafeInteger(
        progressTuple[0],
        "Achievement progress generation",
      ),
      lifetimeBattleCount: readNonNegativeSafeInteger(
        progressTuple[1],
        "Achievement lifetime battle count",
      ),
      baselineLevelsByValue: decodeCompleteValueNumberMap(
        activeDeck,
        progressTuple[2],
        "Achievement baseline levels",
        1,
      ),
      topFiveAlreadyRevealedAtReset: readBoolean(
        progressTuple[3],
        "Top Five achievement reset baseline",
      ),
      countedBattleWindow: {
        ids: decodeCountedBattleWindow(progressTuple[4]),
        capacity: COUNTED_BATTLE_WINDOW_CAPACITY,
      },
    },
  })

  if (JSON.stringify(encodeAchievementState(state)) !== JSON.stringify(value)) {
    throw new Error("Achievement State encoding is not canonical")
  }

  return state
}
