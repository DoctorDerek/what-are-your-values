import { readAchievementId } from "./AchievementCatalog"
import { markAchievementPresented } from "./AchievementState"
import { applyAchievementTransition } from "./AchievementTransition"
import {
  createBattleChoiceCommit,
  createBattleUndoCommit,
  type BattleProfileCommit,
} from "./BattleProfileCommit"
import { projectBattlePair } from "./BattleScheduler"
import { createCustomValueAddCommit } from "./CustomValueCommands"
import {
  createInitialPlayerData,
  createPlayerData,
  type PlayerData,
} from "./PlayerData"
import { createPlayerSettings } from "./PlayerSettings"
import { createWayvmExport, serializeWayvmExport } from "./WayvmExport"

const CREATED_AT = "2026-08-01T10:00:00.000Z"
const CUSTOM_VALUE_CREATED_AT = "2026-08-01T10:01:00.000Z"
const FIRST_BATTLE_AT = "2026-08-01T10:02:00.000Z"
const SECOND_BATTLE_AT = "2026-08-01T10:03:00.000Z"
const UNDO_AT = "2026-08-01T10:04:00.000Z"

export const WAYVM_EXPORT_V1_TEST_VECTOR = Object.freeze({
  expectedByteLength: 23_756,
  expectedContentHash:
    "d34e251f68eb7ef030775ba39d895e23f95804f68944d6836b918eda463aa84f",
  exportedAt: "2026-08-01T10:05:00.000Z",
  sourceAppVersion: "5.2.0",
  sourceBuild: "schema-one-cross-platform-compatibility-vector",
})

function applyCommit(
  playerData: PlayerData,
  commit: BattleProfileCommit,
  occurredAt: string,
) {
  return createPlayerData({
    ...playerData,
    profile: commit.profile,
    achievements: applyAchievementTransition({
      state: playerData.achievements,
      priorProfile: playerData.profile,
      resultingProfile: commit.profile,
      event: commit.event,
      occurredAt,
    }),
  })
}

export async function createWayvmExportV1TestVector() {
  let playerData = createInitialPlayerData({
    schedulerSeed: "wayvm-export-v1-test-vector",
    createdAt: CREATED_AT,
  })
  const customValueCommit = createCustomValueAddCommit({
    profile: playerData.profile,
    name: "Ingenuity 🦝",
    definition:
      "Finding creative, resourceful paths through meaningful problems—con curiosidad.",
    now: () => CUSTOM_VALUE_CREATED_AT,
    randomUuid: () => "00000000-0000-4000-8000-000000000133",
  })
  playerData = applyCommit(
    playerData,
    customValueCommit,
    CUSTOM_VALUE_CREATED_AT,
  )

  const customValueId = playerData.profile.activeDeck.customValues[0]?.id
  if (!customValueId) throw new Error("The test vector requires a Custom Value")

  const firstPair = projectBattlePair(
    playerData.profile.activeDeck,
    playerData.profile.scheduler,
  )
  if (!firstPair.includes(customValueId))
    throw new Error("The test vector requires an active Join Pass")

  const firstBattleCommit = createBattleChoiceCommit({
    profile: playerData.profile,
    winnerId: customValueId,
    expectedScheduler: playerData.profile.scheduler,
  })
  playerData = applyCommit(playerData, firstBattleCommit, FIRST_BATTLE_AT)

  const secondPair = projectBattlePair(
    playerData.profile.activeDeck,
    playerData.profile.scheduler,
  )
  const secondWinnerId = secondPair.find((valueId) => valueId !== customValueId)
  if (!secondWinnerId)
    throw new Error("The test vector requires a canonical Join Pass opponent")

  const secondBattleCommit = createBattleChoiceCommit({
    profile: playerData.profile,
    winnerId: secondWinnerId,
    expectedScheduler: playerData.profile.scheduler,
  })
  playerData = applyCommit(playerData, secondBattleCommit, SECOND_BATTLE_AT)

  const undoCommit = createBattleUndoCommit(playerData.profile)
  if (!undoCommit) throw new Error("The test vector requires one Undo")
  playerData = applyCommit(playerData, undoCommit, UNDO_AT)

  const firstBattleAchievementId = readAchievementId(
    "battle.first",
    "Achievement ID",
  )
  playerData = createPlayerData({
    ...playerData,
    achievements: markAchievementPresented({
      activeDeck: playerData.profile.activeDeck,
      state: playerData.achievements,
      achievementId: firstBattleAchievementId,
    }),
    settings: createPlayerSettings({
      locale: "en",
      reducedMotion: "on",
      controlHints: "always",
      reflectionCards: "none",
    }),
  })

  const wayvmExport = await createWayvmExport({
    exportedAt: WAYVM_EXPORT_V1_TEST_VECTOR.exportedAt,
    sourceAppVersion: WAYVM_EXPORT_V1_TEST_VECTOR.sourceAppVersion,
    sourceBuild: WAYVM_EXPORT_V1_TEST_VECTOR.sourceBuild,
    playerData,
  })

  return Object.freeze({
    wayvmExport,
    serialized: serializeWayvmExport(wayvmExport),
    customValueId,
    firstBattleAchievementId,
  })
}
