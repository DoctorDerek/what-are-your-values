declare const achievementIdBrand: unique symbol

export type AchievementId = string & {
  readonly [achievementIdBrand]: "achievement"
}

export type AchievementCondition =
  | Readonly<{ kind: "battle-count"; threshold: number }>
  | Readonly<{ kind: "cycle-complete" }>
  | Readonly<{ kind: "top-five" }>
  | Readonly<{ kind: "value-level"; threshold: number }>

export type AchievementDefinition = {
  readonly id: AchievementId
  readonly condition: AchievementCondition
  readonly title: string
  readonly description: string
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
  title: string,
): AchievementDefinition {
  return Object.freeze({
    id: createAchievementId(id),
    condition: Object.freeze({ kind: "battle-count", threshold }),
    title,
    description: `Compare ${threshold.toLocaleString("en-US")} ${
      threshold === 1 ? "pair" : "pairs"
    } of values.`,
  })
}

const battleCountAchievements = Object.freeze([
  createBattleCountAchievement("battle.first", 1, "First Battle"),
  createBattleCountAchievement("battle.10", 10, "10 Battles"),
  ...HUNDRED_BATTLE_ACHIEVEMENT_THRESHOLDS.map((threshold) =>
    createBattleCountAchievement(
      `battle.${threshold}`,
      threshold,
      `${threshold.toLocaleString("en-US")} Battles`,
    ),
  ),
])

const completionAchievements = Object.freeze([
  Object.freeze({
    id: createAchievementId("cycle.first"),
    condition: Object.freeze({ kind: "cycle-complete" }),
    title: "Complete a Pair Cycle",
    description: "Compare every unique pair in one Active Deck cycle.",
  }),
  Object.freeze({
    id: createAchievementId("topFive.first"),
    condition: Object.freeze({ kind: "top-five" }),
    title: "Reveal Your Top Five",
    description: "Earn experience for at least five different values.",
  }),
] satisfies readonly AchievementDefinition[])

const valueLevelAchievements = Object.freeze(
  VALUE_LEVEL_ACHIEVEMENT_THRESHOLDS.map(
    (threshold) =>
      Object.freeze({
        id: createAchievementId(`valueLevel.${threshold}`),
        condition: Object.freeze({ kind: "value-level", threshold }),
        title: `Reach Level ${threshold}`,
        description: `Raise any value to Level ${threshold}.`,
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
