import { readAchievementId } from "@game/machines/src/AchievementCatalog"
import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import NativeAchievements from "@/components/NativeAchievements"

const lockedAchievement = Object.freeze({
  id: readAchievementId("battle.first", "Native achievement test ID"),
  title: "First Battle",
  requirement: "Compare your first pair of values.",
  status: "locked",
  progress: Object.freeze({
    kind: "numeric",
    current: 0,
    target: 1,
    label: "0 of 1 comparisons",
  }),
  unlockedAt: null,
  unlockedDate: null,
} satisfies AchievementPresentation)

const unlockedAchievement = Object.freeze({
  id: readAchievementId("battle.5", "Native achievement test ID"),
  title: "5 Battles",
  requirement: "Compare 5 pairs of values.",
  status: "unlocked",
  progress: null,
  unlockedAt: "2026-08-28T12:00:00.000Z",
  unlockedDate: "Aug 28, 2026",
} satisfies AchievementPresentation)

describe("NativeAchievements", () => {
  it("routes Menu and Hub navigation from a stable achievement catalog", async () => {
    const onClose = jest.fn()
    const onOpenMenu = jest.fn()
    const user = userEvent.setup()
    await render(
      <NativeAchievements
        achievements={[lockedAchievement]}
        canOpenMenu
        onClose={onClose}
        onOpenMenu={onOpenMenu}
      />,
    )

    const menu = screen.getByRole("button", { name: "Menu" })
    const close = screen.getByRole("button", { name: "Back to Your Values" })
    expect(menu).toBeEnabled()
    expect(close).toBeEnabled()

    await user.press(menu)
    await user.press(close)

    expect(onOpenMenu).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("keeps navigation inert while achievement acknowledgement is pending", async () => {
    const onClose = jest.fn()
    const onOpenMenu = jest.fn()
    const user = userEvent.setup()
    await render(
      <NativeAchievements
        achievements={[lockedAchievement]}
        canOpenMenu={false}
        onClose={onClose}
        onOpenMenu={onOpenMenu}
      />,
    )

    const menu = screen.getByRole("button", { name: "Menu" })
    const close = screen.getByRole("button", { name: "Back to Your Values" })
    expect(menu).toBeDisabled()
    expect(close).toBeDisabled()

    await user.press(menu)
    await user.press(close)

    expect(onOpenMenu).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("distinguishes locked progress from completed milestone dates", async () => {
    await render(
      <NativeAchievements
        achievements={[lockedAchievement, unlockedAchievement]}
        canOpenMenu
        onClose={jest.fn()}
        onOpenMenu={jest.fn()}
      />,
    )

    expect(screen.getByText("1 of 2 unlocked")).toBeOnTheScreen()
    expect(screen.getByText("Not unlocked")).toBeOnTheScreen()
    expect(screen.getByText("0 of 1 comparisons")).toBeOnTheScreen()
    expect(screen.getByText("Unlocked")).toBeOnTheScreen()
    expect(screen.getByText("Unlocked Aug 28, 2026")).toBeOnTheScreen()
  })
})
