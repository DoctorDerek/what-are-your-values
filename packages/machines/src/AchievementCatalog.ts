declare const achievementIdBrand: unique symbol

export type AchievementId = string & {
  readonly [achievementIdBrand]: "achievement"
}

export type AchievementCondition =
  | Readonly<{ kind: "battleCount"; threshold: number }>
  | Readonly<{ kind: "cycleComplete" }>
  | Readonly<{ kind: "topFive" }>
  | Readonly<{ kind: "valueLevel"; threshold: number }>

export const ACHIEVEMENT_COPY_KEYS = Object.freeze({
  firstBattle: Object.freeze({
    titleKey: "achievements.firstBattle.title",
    descriptionKey: "achievements.firstBattle.description",
  }),
  battleCount: Object.freeze({
    titleKey: "achievements.battleCount.title",
    descriptionKey: "achievements.battleCount.description",
  }),
  cycleComplete: Object.freeze({
    titleKey: "achievements.cycleComplete.title",
    descriptionKey: "achievements.cycleComplete.description",
  }),
  topFive: Object.freeze({
    titleKey: "achievements.topFive.title",
    descriptionKey: "achievements.topFive.description",
  }),
  valueLevel: Object.freeze({
    titleKey: "achievements.valueLevel.title",
    descriptionKey: "achievements.valueLevel.description",
  }),
} as const)

type AchievementCopyKeys =
  (typeof ACHIEVEMENT_COPY_KEYS)[keyof typeof ACHIEVEMENT_COPY_KEYS]

export type AchievementTitleKey = AchievementCopyKeys["titleKey"]
export type AchievementDescriptionKey = AchievementCopyKeys["descriptionKey"]

export type AchievementDefinition = {
  readonly id: AchievementId
  readonly condition: AchievementCondition
  readonly titleKey: AchievementTitleKey
  readonly descriptionKey: AchievementDescriptionKey
}

export const VALUE_LEVEL_ACHIEVEMENT_THRESHOLDS = [5, 10, 25, 50, 100] as const

export const HUNDRED_BATTLE_ACHIEVEMENT_THRESHOLDS = Object.freeze(
  Array.from({ length: 100 }, (_unused, index) => (index + 1) * 100),
)

function createAchievementId(value: string) {
  return value as AchievementId
}

function createBattleCountAchievement(
  id: string,
  threshold: number,
  copyKeys: Readonly<{
    titleKey: AchievementTitleKey
    descriptionKey: AchievementDescriptionKey
  }>,
): AchievementDefinition {
  return Object.freeze({
    id: createAchievementId(id),
    condition: Object.freeze({ kind: "battleCount", threshold }),
    ...copyKeys,
  })
}

const battleCountAchievements = Object.freeze([
  createBattleCountAchievement(
    "battle.first",
    1,
    ACHIEVEMENT_COPY_KEYS.firstBattle,
  ),
  createBattleCountAchievement(
    "battle.10",
    10,
    ACHIEVEMENT_COPY_KEYS.battleCount,
  ),
  ...HUNDRED_BATTLE_ACHIEVEMENT_THRESHOLDS.map((threshold) =>
    createBattleCountAchievement(
      `battle.${threshold}`,
      threshold,
      ACHIEVEMENT_COPY_KEYS.battleCount,
    ),
  ),
])

const completionAchievements = Object.freeze([
  Object.freeze({
    id: createAchievementId("cycle.first"),
    condition: Object.freeze({ kind: "cycleComplete" }),
    ...ACHIEVEMENT_COPY_KEYS.cycleComplete,
  }),
  Object.freeze({
    id: createAchievementId("topFive.first"),
    condition: Object.freeze({ kind: "topFive" }),
    ...ACHIEVEMENT_COPY_KEYS.topFive,
  }),
] satisfies readonly AchievementDefinition[])

const valueLevelAchievements = Object.freeze(
  VALUE_LEVEL_ACHIEVEMENT_THRESHOLDS.map(
    (threshold) =>
      Object.freeze({
        id: createAchievementId(`valueLevel.${threshold}`),
        condition: Object.freeze({ kind: "valueLevel", threshold }),
        ...ACHIEVEMENT_COPY_KEYS.valueLevel,
      }) satisfies AchievementDefinition,
  ),
)

export const ACHIEVEMENT_CATALOG = Object.freeze([
  ...battleCountAchievements,
  ...completionAchievements,
  ...valueLevelAchievements,
])

const ACHIEVEMENT_IDS = new Set(
  ACHIEVEMENT_CATALOG.map(({ id }) => id as string),
)

export function isAchievementId(value: string): value is AchievementId {
  return ACHIEVEMENT_IDS.has(value)
}

export function readAchievementId(value: unknown, label: string) {
  if (typeof value !== "string" || !isAchievementId(value)) {
    throw new Error(`Invalid ${label}: ${String(value)}`)
  }

  return value
}

export function getAchievementDefinition(id: AchievementId) {
  const definition = ACHIEVEMENT_CATALOG.find(
    (achievement) => achievement.id === id,
  )
  if (!definition) {
    throw new Error(`Unknown Achievement ID: ${id}`)
  }

  return definition
}
