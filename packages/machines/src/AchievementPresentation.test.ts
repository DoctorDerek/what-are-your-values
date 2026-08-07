import {
  createValueProgress,
  createValueProgressById,
} from "@game/data/src/ValueProgress"
import { describe, expect, it } from "vitest"
import { ACHIEVEMENT_CATALOG, readAchievementId } from "./AchievementCatalog"
import {
  formatAchievementUnlockedDate,
  getAchievementEnglishCopy,
  projectAchievementCatalog,
} from "./AchievementPresentation"
import {
  createAchievementState,
  createInitialAchievementState,
} from "./AchievementState"
import { createInitialBattleProfile } from "./BattleProfile"

const UNLOCKED_AT = "2026-07-30T04:30:00.000Z"

function createProfileWithXp(totalXpByIndex: readonly number[]) {
  const profile = createInitialBattleProfile("achievement-presentation-seed")
  const progressById = createValueProgressById(
    profile.activeDeck,
    profile.activeDeck.valueIds.map((valueId, index) => {
      const totalXp = totalXpByIndex[index] ?? 0
      const minimumPayoutWins = totalXp / 4

      return [
        valueId,
        createValueProgress(valueId, {
          totalXp,
          profileWins: minimumPayoutWins,
          profileComparisons: minimumPayoutWins,
          currentCycleWins: minimumPayoutWins,
        }),
      ]
    }),
  )

  return Object.freeze({ ...profile, progressById })
}

function requirePresentation(
  catalog: ReturnType<typeof projectAchievementCatalog>,
  id: string,
) {
  const presentation = catalog.find((achievement) => achievement.id === id)
  if (!presentation)
    throw new Error(`Achievement presentation is unavailable: ${id}`)

  return presentation
}

describe("Achievement presentation", () => {
  it("projects the complete permanent catalog with exact GDD v5.2 English copy", () => {
    expect(
      ACHIEVEMENT_CATALOG.map((achievement) => ({
        id: achievement.id,
        ...getAchievementEnglishCopy(achievement),
      })),
    ).toEqual([
      {
        id: "battle.first",
        title: "First Battle",
        requirement: "Compare your first pair of values.",
      },
      ...[
        5, 10, 25, 37, 50, 77, 100, 200, 300, 400, 500, 600, 700, 777, 800, 900,
        1_000, 1_100, 1_200, 1_300, 1_400, 1_500, 1_600, 1_700, 1_800, 1_900,
        2_000, 2_100, 2_200, 2_300, 2_400,
      ].map((threshold) => ({
        id: `battle.${threshold}`,
        title: `${threshold.toLocaleString("en-US")} Battles`,
        requirement: `Compare ${threshold.toLocaleString("en-US")} pairs of values.`,
      })),
      {
        id: "topFive.first",
        title: "Reveal Your Top Five",
        requirement:
          "Reach the first moment when at least five different values have earned XP and the Hub can display a player-produced Top Five.",
      },
      ...[5, 10, 25, 37, 50, 77, 100].map((threshold) => ({
        id: `valueLevel.${threshold}`,
        title: `Reach Level ${threshold}`,
        requirement: `Raise any value to Level ${threshold}.`,
      })),
    ])
  })

  it("returns immutable copy records and UTC-normalized unlock dates", () => {
    const copy = getAchievementEnglishCopy(ACHIEVEMENT_CATALOG[0]!)

    expect(Object.isFrozen(copy)).toBe(true)
    expect(formatAchievementUnlockedDate("2026-07-29T23:30:00-05:00")).toBe(
      "Jul 30, 2026",
    )
  })

  it("projects all forty locked milestones in canonical order with honest initial progress", () => {
    const battleProfile = createInitialBattleProfile(
      "initial-achievement-presentation-seed",
    )
    const catalog = projectAchievementCatalog({
      achievementState: createInitialAchievementState(battleProfile.activeDeck),
      battleProfile,
    })

    expect(Object.isFrozen(catalog)).toBe(true)
    expect(catalog.map(({ id }) => id)).toEqual(
      ACHIEVEMENT_CATALOG.map(({ id }) => id),
    )
    expect(catalog).toHaveLength(40)
    expect(catalog.every((achievement) => Object.isFrozen(achievement))).toBe(
      true,
    )
    expect(requirePresentation(catalog, "battle.first").progress).toEqual({
      kind: "numeric",
      current: 0,
      target: 1,
      label: "0 of 1 comparisons",
    })
    expect(requirePresentation(catalog, "topFive.first").progress).toEqual({
      kind: "numeric",
      current: 0,
      target: 5,
      label: "0 of 5 values have earned XP",
    })
    expect(requirePresentation(catalog, "valueLevel.5").progress).toEqual({
      kind: "numeric",
      current: 1,
      target: 5,
      label: "Highest eligible value: Level 1 of Level 5",
    })
  })

  it("caps numeric progress while preserving current battle Top Five and eligible-Level evidence", () => {
    const battleProfile = createProfileWithXp([8, 4, 4])
    const initialState = createInitialAchievementState(battleProfile.activeDeck)
    const achievementState = createAchievementState({
      activeDeck: battleProfile.activeDeck,
      unlocks: [],
      presentedAchievementIds: [],
      progress: {
        ...initialState.progress,
        lifetimeBattleCount: 250,
      },
    })
    const catalog = projectAchievementCatalog({
      achievementState,
      battleProfile,
    })

    expect(requirePresentation(catalog, "battle.100").progress).toEqual({
      kind: "numeric",
      current: 100,
      target: 100,
      label: "100 of 100 comparisons",
    })
    expect(requirePresentation(catalog, "battle.300").progress).toEqual({
      kind: "numeric",
      current: 250,
      target: 300,
      label: "250 of 300 comparisons",
    })
    expect(requirePresentation(catalog, "topFive.first").progress).toEqual({
      kind: "numeric",
      current: 3,
      target: 5,
      label: "3 of 5 values have earned XP",
    })
    expect(requirePresentation(catalog, "valueLevel.10").progress).toEqual({
      kind: "numeric",
      current: 5,
      target: 10,
      label: "Highest eligible value: Level 5 of Level 10",
    })
  })

  it("replaces unattainable post-reset progress with explicit eligibility guidance", () => {
    const battleProfile = createProfileWithXp([8, 4])
    const initialState = createInitialAchievementState(battleProfile.activeDeck)
    const achievementState = createAchievementState({
      activeDeck: battleProfile.activeDeck,
      unlocks: [],
      presentedAchievementIds: [],
      progress: {
        ...initialState.progress,
        baselineLevelsByValue: new Map(
          battleProfile.activeDeck.valueIds.map((valueId) => [valueId, 5]),
        ),
        topFiveAlreadyRevealedAtReset: true,
      },
    })
    const catalog = projectAchievementCatalog({
      achievementState,
      battleProfile,
    })

    expect(requirePresentation(catalog, "topFive.first").progress).toEqual({
      kind: "eligibility",
      label: "Reset Levels & Experience before revealing your Top Five again.",
    })
    expect(requirePresentation(catalog, "valueLevel.5").progress).toEqual({
      kind: "eligibility",
      label: "No active value is currently eligible to cross Level 5.",
    })
  })

  it("treats already-qualified imported Top Five state as ineligible instead of complete", () => {
    const battleProfile = createProfileWithXp([4, 4, 4, 4, 4])
    const catalog = projectAchievementCatalog({
      achievementState: createInitialAchievementState(battleProfile.activeDeck),
      battleProfile,
    })

    expect(requirePresentation(catalog, "topFive.first").progress).toEqual({
      kind: "eligibility",
      label: "Reset Levels & Experience before revealing your Top Five again.",
    })
  })

  it("shows unlock status and UTC date without contradictory current progress", () => {
    const battleProfile = createInitialBattleProfile(
      "unlocked-achievement-presentation-seed",
    )
    const initialState = createInitialAchievementState(battleProfile.activeDeck)
    const firstBattleId = readAchievementId("battle.first", "Achievement ID")
    const catalog = projectAchievementCatalog({
      achievementState: createAchievementState({
        activeDeck: battleProfile.activeDeck,
        unlocks: [
          {
            id: firstBattleId,
            unlockedAt: UNLOCKED_AT,
            eventToken: "first-battle-presentation-event",
          },
        ],
        presentedAchievementIds: [],
        progress: {
          ...initialState.progress,
          lifetimeBattleCount: 1,
        },
      }),
      battleProfile,
    })

    expect(requirePresentation(catalog, "battle.first")).toMatchObject({
      status: "unlocked",
      progress: null,
      unlockedAt: UNLOCKED_AT,
      unlockedDate: "Jul 30, 2026",
    })
    expect(requirePresentation(catalog, "battle.5")).toMatchObject({
      status: "locked",
      unlockedAt: null,
      unlockedDate: null,
    })
  })
})
