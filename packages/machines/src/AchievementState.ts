import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import {
  getAchievementDefinition,
  type AchievementId,
} from "./AchievementCatalog"
import type { BattleId } from "./BattleIdentity"
import { VALIDATED_TIMELINE_DELTA_LIMIT } from "./BattleTimeline"
import {
  readIsoTimestamp,
  readNonNegativeSafeInteger,
  readPositiveSafeInteger,
} from "./PersistenceValidation"

export const COUNTED_BATTLE_WINDOW_CAPACITY = VALIDATED_TIMELINE_DELTA_LIMIT + 1

export type AchievementUnlock = {
  readonly id: AchievementId
  readonly unlockedAt: string
  readonly eventToken: string
}

export type BoundedBattleIdSet = {
  readonly ids: readonly BattleId[]
  readonly capacity: number
}

export type AchievementProgress = {
  readonly achievementProgressGeneration: number
  readonly lifetimeBattleCount: number
  readonly completedCycleCount: number
  readonly baselineLevelsByValue: ReadonlyMap<ValueId, number>
  readonly topFiveAlreadyRevealedAtReset: boolean
  readonly countedBattleWindow: BoundedBattleIdSet
}

export type AchievementState = {
  readonly unlocks: readonly AchievementUnlock[]
  readonly presentedAchievementIds: readonly AchievementId[]
  readonly progress: AchievementProgress
}

function validateUniqueStrings(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicate values`)
  }
}

function validateAchievementUnlocks(
  unlocks: readonly AchievementUnlock[],
): readonly AchievementUnlock[] {
  const frozenUnlocks = Object.freeze(
    unlocks.map((unlock) => {
      getAchievementDefinition(unlock.id)
      if (unlock.eventToken.length === 0) {
        throw new Error(`Achievement event token is required: ${unlock.id}`)
      }

      return Object.freeze({
        id: unlock.id,
        unlockedAt: readIsoTimestamp(
          unlock.unlockedAt,
          `Achievement unlock timestamp for ${unlock.id}`,
        ),
        eventToken: unlock.eventToken,
      })
    }),
  )

  validateUniqueStrings(
    frozenUnlocks.map(({ id }) => id),
    "Achievement unlocks",
  )
  validateUniqueStrings(
    frozenUnlocks.map(({ eventToken }) => eventToken),
    "Achievement event tokens",
  )

  return frozenUnlocks
}

function validatePresentedAchievementIds({
  unlocks,
  presentedAchievementIds,
}: {
  readonly unlocks: readonly AchievementUnlock[]
  readonly presentedAchievementIds: readonly AchievementId[]
}) {
  validateUniqueStrings(presentedAchievementIds, "Presented Achievement IDs")
  const unlockedIds = new Set(unlocks.map(({ id }) => id))

  return Object.freeze(
    presentedAchievementIds.map((id) => {
      getAchievementDefinition(id)
      if (!unlockedIds.has(id)) {
        throw new Error(`Presented Achievement is not unlocked: ${id}`)
      }

      return id
    }),
  )
}

function validateBaselineLevelsByValue({
  activeDeck,
  baselineLevelsByValue,
}: {
  readonly activeDeck: ActiveDeck
  readonly baselineLevelsByValue: ReadonlyMap<ValueId, number>
}) {
  if (baselineLevelsByValue.size !== activeDeck.valueIds.length) {
    throw new Error(
      "Achievement baseline levels do not cover the complete Active Deck",
    )
  }

  const activeValueIds = new Set(activeDeck.valueIds)
  baselineLevelsByValue.forEach((_level, valueId) => {
    if (!activeValueIds.has(valueId)) {
      throw new Error(
        `Achievement baseline levels contain an inactive ID: ${valueId}`,
      )
    }
  })

  return new Map(
    activeDeck.valueIds.map((valueId) => {
      const level = baselineLevelsByValue.get(valueId)
      if (level === undefined) {
        throw new Error(
          `Achievement baseline level is missing an active ID: ${valueId}`,
        )
      }

      return [
        valueId,
        readPositiveSafeInteger(
          level,
          `Achievement baseline level for ${valueId}`,
        ),
      ] as const
    }),
  )
}

export function createBoundedBattleIdSet(
  ids: readonly BattleId[],
): BoundedBattleIdSet {
  if (ids.length > COUNTED_BATTLE_WINDOW_CAPACITY) {
    throw new Error("Counted Battle window exceeds its bounded capacity")
  }
  if (ids.some((battleId) => battleId.length === 0)) {
    throw new Error("Counted Battle window contains an empty Battle ID")
  }

  validateUniqueStrings(ids, "Counted Battle window")
  return Object.freeze({
    ids: Object.freeze([...ids]),
    capacity: COUNTED_BATTLE_WINDOW_CAPACITY,
  })
}

function validateCountedBattleWindow(
  countedBattleWindow: BoundedBattleIdSet,
) {
  if (countedBattleWindow.capacity !== COUNTED_BATTLE_WINDOW_CAPACITY) {
    throw new Error("Counted Battle window has a noncanonical capacity")
  }

  return createBoundedBattleIdSet(countedBattleWindow.ids)
}

export function createAchievementState({
  activeDeck,
  unlocks,
  presentedAchievementIds,
  progress,
}: {
  readonly activeDeck: ActiveDeck
  readonly unlocks: readonly AchievementUnlock[]
  readonly presentedAchievementIds: readonly AchievementId[]
  readonly progress: AchievementProgress
}): AchievementState {
  const validatedUnlocks = validateAchievementUnlocks(unlocks)
  const validatedPresentedAchievementIds = validatePresentedAchievementIds({
    unlocks: validatedUnlocks,
    presentedAchievementIds,
  })
  const lifetimeBattleCount = readNonNegativeSafeInteger(
    progress.lifetimeBattleCount,
    "Achievement lifetime battle count",
  )
  const completedCycleCount = readNonNegativeSafeInteger(
    progress.completedCycleCount,
    "Achievement completed-cycle count",
  )
  const countedBattleWindow = validateCountedBattleWindow(
    progress.countedBattleWindow,
  )

  if (lifetimeBattleCount < countedBattleWindow.ids.length) {
    throw new Error(
      "Achievement lifetime battle count is lower than its counted window",
    )
  }
  if (completedCycleCount > lifetimeBattleCount) {
    throw new Error(
      "Achievement completed-cycle count exceeds lifetime battles",
    )
  }
  if (typeof progress.topFiveAlreadyRevealedAtReset !== "boolean") {
    throw new Error("Invalid Top Five achievement reset baseline")
  }

  return Object.freeze({
    unlocks: validatedUnlocks,
    presentedAchievementIds: validatedPresentedAchievementIds,
    progress: Object.freeze({
      achievementProgressGeneration: readNonNegativeSafeInteger(
        progress.achievementProgressGeneration,
        "Achievement progress generation",
      ),
      lifetimeBattleCount,
      completedCycleCount,
      baselineLevelsByValue: validateBaselineLevelsByValue({
        activeDeck,
        baselineLevelsByValue: progress.baselineLevelsByValue,
      }),
      topFiveAlreadyRevealedAtReset: progress.topFiveAlreadyRevealedAtReset,
      countedBattleWindow,
    }),
  })
}

export function createInitialAchievementState(activeDeck: ActiveDeck) {
  return createAchievementState({
    activeDeck,
    unlocks: [],
    presentedAchievementIds: [],
    progress: {
      achievementProgressGeneration: 0,
      lifetimeBattleCount: 0,
      completedCycleCount: 0,
      baselineLevelsByValue: new Map(
        activeDeck.valueIds.map((valueId) => [valueId, 1]),
      ),
      topFiveAlreadyRevealedAtReset: false,
      countedBattleWindow: createBoundedBattleIdSet([]),
    },
  })
}

export function getPendingAchievementUnlocks(state: AchievementState) {
  const presentedIds = new Set(state.presentedAchievementIds)
  return state.unlocks.filter(({ id }) => !presentedIds.has(id))
}
