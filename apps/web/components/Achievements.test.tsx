import {
  ACHIEVEMENT_CATALOG,
  readAchievementId,
} from "@game/machines/src/AchievementCatalog"
import {
  createAchievementState,
  createInitialAchievementState,
} from "@game/machines/src/AchievementState"
import { createInitialBattleProfile } from "@game/machines/src/BattleProfile"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Achievements from "./Achievements"

describe("Achievements", () => {
  it("shows the complete honest catalog with private progress and unlocked dates", () => {
    const battleProfile = createInitialBattleProfile("achievements-screen-seed")
    const initialState = createInitialAchievementState(battleProfile.activeDeck)
    const achievementState = createAchievementState({
      activeDeck: battleProfile.activeDeck,
      unlocks: [
        {
          id: readAchievementId("battle.first", "Achievement ID"),
          unlockedAt: "2026-07-29T12:34:56.000Z",
          eventToken: "achievements-screen-first-battle",
        },
      ],
      presentedAchievementIds: [],
      progress: {
        ...initialState.progress,
        lifetimeBattleCount: 1,
      },
    })
    const onClose = vi.fn()

    render(
      <Achievements
        achievementState={achievementState}
        battleProfile={battleProfile}
        onClose={onClose}
      />,
    )

    expect(
      screen.getByText(
        "Clear milestones from your private, offline progress. Achievements do not compare you with anyone else.",
      ),
    ).toBeVisible()
    expect(screen.getByRole("status")).toHaveTextContent(
      `1 of ${ACHIEVEMENT_CATALOG.length} unlocked`,
    )
    expect(screen.getAllByRole("listitem")).toHaveLength(
      ACHIEVEMENT_CATALOG.length,
    )

    const firstBattleRow = screen
      .getByRole("heading", { name: "First Battle" })
      .closest("li")
    const tenBattlesRow = screen
      .getByRole("heading", { name: "10 Battles" })
      .closest("li")
    const topFiveRow = screen
      .getByRole("heading", { name: "Reveal Your Top Five" })
      .closest("li")
    if (!firstBattleRow || !tenBattlesRow || !topFiveRow) {
      throw new Error("Achievement screen rows are unavailable")
    }

    expect(
      within(firstBattleRow).getByText("Unlocked", { selector: "span" }),
    ).toBeVisible()
    expect(
      within(firstBattleRow).getByText("Jul 29, 2026", {
        selector: "time",
      }),
    ).toBeVisible()
    expect(within(tenBattlesRow).getByText("1 of 10 comparisons")).toBeVisible()
    expect(
      within(topFiveRow).getByText("0 of 5 values at Level 2"),
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Back to Your Values" }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
