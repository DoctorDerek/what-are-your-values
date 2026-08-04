declare const achievementIdBrand: unique symbol

export type AchievementId = string & {
  readonly [achievementIdBrand]: "achievement"
}

export type AchievementCondition =
  | Readonly<{ kind: "battleCount"; threshold: number }>
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

export const BATTLE_ACHIEVEMENT_THRESHOLDS = [
  1, 5, 10, 25, 37, 50, 77, 100, 200, 300, 400, 500, 600, 700, 777, 800, 900,
  1_000, 1_100, 1_200, 1_300, 1_400, 1_500, 1_600, 1_700, 1_800, 1_900, 2_000,
  2_100, 2_200, 2_300, 2_400,
] as const

export const VALUE_LEVEL_ACHIEVEMENT_THRESHOLDS = [
  5, 10, 25, 37, 50, 77, 100,
] as const

function createAchievementId(value: string) {
  return value as AchievementId
}

function createBattleCountAchievement(
  threshold: (typeof BATTLE_ACHIEVEMENT_THRESHOLDS)[number],
): AchievementDefinition {
  return Object.freeze({
    id: createAchievementId(
      threshold === 1 ? "battle.first" : `battle.${threshold}`,
    ),
    condition: Object.freeze({ kind: "battleCount", threshold }),
    ...(threshold === 1
      ? ACHIEVEMENT_COPY_KEYS.firstBattle
      : ACHIEVEMENT_COPY_KEYS.battleCount),
  })
}

const battleCountAchievements = Object.freeze(
  BATTLE_ACHIEVEMENT_THRESHOLDS.map(createBattleCountAchievement),
)

const topFiveAchievement = Object.freeze({
  id: createAchievementId("topFive.first"),
  condition: Object.freeze({ kind: "topFive" }),
  ...ACHIEVEMENT_COPY_KEYS.topFive,
}) satisfies AchievementDefinition

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
  topFiveAchievement,
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
