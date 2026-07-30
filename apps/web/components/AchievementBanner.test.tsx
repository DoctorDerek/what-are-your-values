import { ACHIEVEMENT_CATALOG } from "@game/machines/src/AchievementCatalog"
import type { AchievementUnlock } from "@game/machines/src/AchievementState"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import AchievementBanner from "./AchievementBanner"

const firstAchievement = ACHIEVEMENT_CATALOG[0]
const firstUnlock = Object.freeze({
  id: firstAchievement.id,
  unlockedAt: "2026-07-29T12:34:56.000Z",
  eventToken: "first-achievement-banner",
}) satisfies AchievementUnlock

describe("AchievementBanner Integration", () => {
  it("presents one exact accessible milestone and dismisses it by ID", () => {
    const onPresented = vi.fn()

    render(
      <AchievementBanner
        unlock={firstUnlock}
        isPresentationPersistencePending={false}
        onPresented={onPresented}
      />,
    )

    expect(screen.getByRole("status")).toHaveTextContent(
      `Achievement unlocked: ${firstAchievement.title}.`,
    )
    expect(
      screen.getByRole("heading", { name: firstAchievement.title }),
    ).toBeInTheDocument()
    expect(screen.getByText(firstAchievement.description)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Dismiss achievement" }))
    expect(onPresented).toHaveBeenCalledExactlyOnceWith(firstAchievement.id)
  })

  it("renders nothing without a pending unlock", () => {
    render(
      <AchievementBanner
        unlock={null}
        isPresentationPersistencePending={false}
        onPresented={vi.fn()}
      />,
    )

    expect(
      screen.queryByRole("complementary", { name: "Achievement unlocked" }),
    ).not.toBeInTheDocument()
  })

  it("prevents duplicate dismissal while durable presentation is pending", () => {
    render(
      <AchievementBanner
        unlock={firstUnlock}
        isPresentationPersistencePending
        onPresented={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Dismiss achievement" }),
    ).toBeDisabled()
  })
})
