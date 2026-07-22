import {
  decodeActiveDeck,
  encodeActiveDeck,
  type EncodedActiveDeck,
} from "./ActiveDeckCodec"
import {
  decodeBattleDelta,
  encodeBattleDelta,
  type EncodedBattleDelta,
} from "./BattleDeltaCodec"
import type { BattleProfile } from "./BattleProfile"
import { validateBattleProfile } from "./BattleProfile"
import { getBattleTimelineCapacity } from "./BattleTimeline"
import { validateCycleLevelSnapshot } from "./CycleLevelSnapshot"
import { readNonNegativeSafeInteger, readTuple } from "./PersistenceValidation"
import {
  decodeSchedulerRestorePoint,
  encodeSchedulerRestorePoint,
  type EncodedSchedulerRestorePoint,
} from "./SchedulerCodec"
import {
  decodeCompleteValueNumberMap,
  encodeValueNumberEntries,
  type EncodedValueNumberEntry,
} from "./ValueNumberMapCodec"
import {
  decodeValueProgressById,
  encodeValueProgressEntries,
  type EncodedValueProgressEntry,
} from "./ValueProgressCodec"

export const BATTLE_PROFILE_CODEC_VERSION = 1 as const

export type EncodedBattleProfile = readonly [
  version: number,
  activeDeck: EncodedActiveDeck,
  progress: readonly EncodedValueProgressEntry[],
  cycleLevelSnapshot: readonly EncodedValueNumberEntry[],
  scheduler: EncodedSchedulerRestorePoint,
  history: readonly EncodedBattleDelta[],
  redo: readonly EncodedBattleDelta[],
]

export function encodeBattleProfile(
  profile: BattleProfile,
): EncodedBattleProfile {
  return [
    BATTLE_PROFILE_CODEC_VERSION,
    encodeActiveDeck(profile.activeDeck),
    encodeValueProgressEntries(profile.progressById),
    encodeValueNumberEntries(profile.cycleLevelSnapshot),
    encodeSchedulerRestorePoint(profile.scheduler),
    profile.history.map(encodeBattleDelta),
    profile.redo.map(encodeBattleDelta),
  ]
}

function readEncodedTimeline(value: unknown, label: "History" | "Redo") {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid Battle Profile ${label}`)
  }

  return value
}

export function decodeBattleProfile(value: unknown) {
  const tuple = readTuple(value, 7, "Battle Profile")
  const version = readNonNegativeSafeInteger(
    tuple[0],
    "Battle Profile codec version",
  )
  if (version !== BATTLE_PROFILE_CODEC_VERSION) {
    throw new Error(`Unsupported Battle Profile codec version: ${version}`)
  }

  const activeDeck = decodeActiveDeck(tuple[1])
  const encodedHistory = readEncodedTimeline(tuple[5], "History")
  const encodedRedo = readEncodedTimeline(tuple[6], "Redo")
  const timelineCapacity = getBattleTimelineCapacity(activeDeck.valueIds.length)
  if (encodedHistory.length + encodedRedo.length > timelineCapacity) {
    throw new Error("Battle Profile timeline exceeds its delta capacity")
  }

  const profile = validateBattleProfile({
    activeDeck,
    progressById: decodeValueProgressById(activeDeck, tuple[2]),
    cycleLevelSnapshot: validateCycleLevelSnapshot(
      activeDeck,
      decodeCompleteValueNumberMap(
        activeDeck,
        tuple[3],
        "Cycle Level Snapshot",
        1,
      ),
    ),
    scheduler: decodeSchedulerRestorePoint(
      activeDeck,
      tuple[4],
      "Battle Profile scheduler",
    ),
    history: encodedHistory.map((delta) =>
      decodeBattleDelta(activeDeck, delta),
    ),
    redo: encodedRedo.map((delta) => decodeBattleDelta(activeDeck, delta)),
  })

  if (JSON.stringify(encodeBattleProfile(profile)) !== JSON.stringify(value)) {
    throw new Error("Battle Profile encoding is not canonical")
  }

  return profile
}
