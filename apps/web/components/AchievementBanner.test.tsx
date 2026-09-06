import { ACHIEVEMENT_CATALOG } from "@game/machines/src/AchievementCatalog"
import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import { fireEvent, render, screen } from "@testing-library/react"
import type { HTMLAttributes, PropsWithChildren } from "react"
import { describe, expect, it, vi } from "vitest"
import AchievementBanner from "./AchievementBanner"

type MotionAsideProps = PropsWithChildren<
  Omit<HTMLAttributes<HTMLElement>, "onAnimationComplete"> & {
    readonly initial: unknown
    readonly animate: unknown
    readonly transition: unknown
    readonly onAnimationComplete: () => void
  }
>

vi.mock("motion/react", () => ({
  motion: {
    aside: ({
      children,
      initial,
      animate,
      transition,
      onAnimationComplete,
      ...props
    }: MotionAsideProps) => (
      <aside
        {...props}
        data-motion-initial={JSON.stringify(initial)}
        data-motion-animate={JSON.stringify(animate)}
        data-motion-transition={JSON.stringify(transition)}
        onTransitionEnd={onAnimationComplete}
      >
        {children}
      </aside>
    ),
  },
}))

const firstAchievement = ACHIEVEMENT_CATALOG[0]
const firstAchievementPresentation = Object.freeze({
  id: firstAchievement.id,
  title: "First Battle",
  requirement: "Compare your first pair of values.",
  status: "unlocked",
  progress: null,
  unlockedAt: "2026-08-07T12:34:56.000Z",
  unlockedDate: "Aug 7, 2026",
}) satisfies AchievementPresentation

describe("AchievementBanner Integration", () => {
  it("presents exact milestone copy accessibly and dismisses only its canonical ID", () => {
    const onPresented = vi.fn()

    render(
      <AchievementBanner
        achievement={firstAchievementPresentation}
        isAcknowledgementPending={false}
        shouldReduceMotion={false}
        onPresented={onPresented}
      />,
    )

    const banner = screen.getByRole("complementary", {
      name: "Achievement unlocked",
    })
    expect(banner).toHaveAttribute(
      "data-motion-initial",
      JSON.stringify({ opacity: 0, y: 24 }),
    )
    const announcement = screen.getByRole("status")
    expect(announcement).toHaveAttribute("aria-live", "polite")
    expect(announcement).toHaveAttribute("aria-atomic", "true")
    expect(announcement).toHaveTextContent(
      "Achievement unlocked: First Battle.",
    )
    expect(
      screen.getByRole("heading", { name: "First Battle" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Compare your first pair of values."),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Dismiss achievement" }))

    expect(onPresented).toHaveBeenCalledExactlyOnceWith(firstAchievement.id)
  })

  it("keeps battle feedback stationary without moving over the value cards", () => {
    render(
      <AchievementBanner
        achievement={firstAchievementPresentation}
        isAcknowledgementPending={false}
        placement="battle"
        shouldReduceMotion={false}
        onPresented={vi.fn()}
      />,
    )

    const banner = screen.getByRole("complementary", {
      name: "Achievement unlocked",
    })
    expect(banner).toHaveClass("relative")
    expect(banner).not.toHaveClass("fixed")
    expect(banner).toHaveAttribute(
      "data-motion-initial",
      JSON.stringify({ opacity: 0, y: 0 }),
    )
    expect(screen.getByText("Compare your first pair of values.")).toBeVisible()
    expect(screen.getByRole("heading", { name: "First Battle" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Dismiss achievement" })).toBeEnabled()
  })

  it("anchors dismissal at the top-right without dividing milestone copy", () => {
    render(
      <AchievementBanner
        achievement={firstAchievementPresentation}
        isAcknowledgementPending={false}
        placement="battle"
        shouldReduceMotion={false}
        onPresented={vi.fn()}
      />,
    )

    const achievementHeading = screen.getByRole("heading", {
      name: "First Battle",
    })
    const achievementPanel = achievementHeading.closest(".pointer-events-auto")
    const dismissButton = screen.getByRole("button", {
      name: "Dismiss achievement",
    })

    expect(achievementPanel).toHaveClass(
      "relative",
      "xl:grid",
      "xl:grid-cols-2",
    )
    expect(achievementHeading.parentElement).toHaveClass("pr-16", "xl:pr-0")
    expect(dismissButton).toHaveClass(
      "absolute",
      "top-4",
      "right-4",
      "focus-visible:outline-black",
    )
  })

  it("uses canonical opaque Vivid contrast tokens for battle feedback", () => {
    render(
      <AchievementBanner
        achievement={firstAchievementPresentation}
        isAcknowledgementPending={false}
        placement="battle"
        shouldReduceMotion={false}
        onPresented={vi.fn()}
      />,
    )

    const achievementPanel = screen
      .getByRole("heading", { name: "First Battle" })
      .closest(".pointer-events-auto")
    expect(achievementPanel).toHaveClass(
      "bg-mapache-vivid-white",
      "text-mapache-vivid-black",
    )
    expect(achievementPanel).not.toHaveClass("bg-mapache-vivid-primary-yellow")
  })

  it("acknowledges through semantic Motion completion without requiring dismissal", () => {
    const onPresented = vi.fn()

    render(
      <AchievementBanner
        achievement={firstAchievementPresentation}
        isAcknowledgementPending={false}
        shouldReduceMotion={false}
        onPresented={onPresented}
      />,
    )

    fireEvent.transitionEnd(
      screen.getByRole("complementary", { name: "Achievement unlocked" }),
    )

    expect(onPresented).toHaveBeenCalledExactlyOnceWith(firstAchievement.id)
  })

  it("removes movement under Reduced Motion while preserving readable dwell time", () => {
    render(
      <AchievementBanner
        achievement={firstAchievementPresentation}
        isAcknowledgementPending={false}
        shouldReduceMotion
        onPresented={vi.fn()}
      />,
    )

    const banner = screen.getByRole("complementary", {
      name: "Achievement unlocked",
    })
    expect(banner).toHaveAttribute(
      "data-motion-initial",
      JSON.stringify({ opacity: 1 }),
    )
    expect(banner).toHaveAttribute(
      "data-motion-animate",
      JSON.stringify({ opacity: [1, 1] }),
    )
    expect(banner).toHaveAttribute(
      "data-motion-transition",
      JSON.stringify({ duration: 8 }),
    )
  })

  it("prevents duplicate explicit dismissal while durable acknowledgement is pending", () => {
    render(
      <AchievementBanner
        achievement={firstAchievementPresentation}
        isAcknowledgementPending
        shouldReduceMotion={false}
        onPresented={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Dismiss achievement" }),
    ).toBeDisabled()
  })

  it("renders nothing without a pending milestone", () => {
    render(
      <AchievementBanner
        achievement={null}
        isAcknowledgementPending={false}
        shouldReduceMotion={false}
        onPresented={vi.fn()}
      />,
    )

    expect(
      screen.queryByRole("complementary", { name: "Achievement unlocked" }),
    ).not.toBeInTheDocument()
  })
})
