import { readAchievementId } from "@game/machines/src/AchievementCatalog"
import { projectAchievementCatalog } from "@game/machines/src/AchievementPresentation"
import {
  createAchievementState,
  createInitialAchievementState,
} from "@game/machines/src/AchievementState"
import { createInitialBattleProfile } from "@game/machines/src/BattleProfile"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Achievements from "./Achievements"

const UNLOCKED_AT = "2026-07-30T04:30:00.000Z"

function createInitialPresentations() {
  const battleProfile = createInitialBattleProfile("achievement-component-seed")

  return projectAchievementCatalog({
    achievementState: createInitialAchievementState(battleProfile.activeDeck),
    battleProfile,
  })
}

function createPresentationsWithFirstBattleUnlocked() {
  const battleProfile = createInitialBattleProfile(
    "unlocked-achievement-component-seed",
  )
  const initialState = createInitialAchievementState(battleProfile.activeDeck)

  return projectAchievementCatalog({
    achievementState: createAchievementState({
      activeDeck: battleProfile.activeDeck,
      unlocks: [
        {
          id: readAchievementId("battle.first", "Achievement ID"),
          unlockedAt: UNLOCKED_AT,
          eventToken: "first-battle-component-event",
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
}

describe("Achievements", () => {
  it("renders all forty milestones once in canonical order and focuses the screen heading", async () => {
    const achievements = createInitialPresentations()

    render(<Achievements achievements={achievements} onClose={vi.fn()} />)

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Achievements", level: 1 }),
      ).toHaveFocus(),
    )
    expect(screen.getByText("0 of 40 unlocked")).toBeVisible()
    expect(
      screen.getByText(
        "Private, offline progress. No leaderboards or social comparison.",
      ),
    ).toBeVisible()
    const rows = screen.getAllByRole("listitem")
    expect(rows).toHaveLength(40)
    expect(
      rows.map((row) => within(row).getByRole("heading").textContent),
    ).toEqual(achievements.map(({ title }) => title))
    expect(
      within(rows[0]!).getByText("Compare your first pair of values."),
    ).toBeVisible()
    expect(
      within(rows.at(-1)!).getByText("Raise any value to Level 100."),
    ).toBeVisible()
  })

  it("distinguishes unlocked dates from honest progress without hiding requirements", () => {
    render(
      <Achievements
        achievements={createPresentationsWithFirstBattleUnlocked()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText("1 of 40 unlocked")).toBeVisible()
    const firstBattle = screen.getAllByRole("listitem")[0]!
    expect(within(firstBattle).getAllByText("Unlocked")).toHaveLength(2)
    expect(within(firstBattle).getByRole("time")).toHaveAttribute(
      "datetime",
      UNLOCKED_AT,
    )
    expect(within(firstBattle).getByRole("time")).toHaveTextContent(
      "Jul 30, 2026",
    )
    expect(
      within(firstBattle).queryByText("1 of 1 comparisons"),
    ).not.toBeInTheDocument()
    expect(
      within(firstBattle).getByText("Compare your first pair of values."),
    ).toBeVisible()
  })

  it("routes the explicit return action without making milestone rows interactive", () => {
    const onClose = vi.fn()

    render(
      <Achievements
        achievements={createInitialPresentations()}
        onClose={onClose}
      />,
    )

    expect(screen.getAllByRole("button")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "Back to Your Values" }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
