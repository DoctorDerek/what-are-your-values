import { ACHIEVEMENT_CATALOG } from "@game/machines/src/AchievementCatalog"
import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import { fireEvent, render, screen } from "@testing-library/react"
import type { HTMLAttributes, PropsWithChildren } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import AchievementBanner from "./AchievementBanner"

const { useReducedMotionMock } = vi.hoisted(() => ({
  useReducedMotionMock: vi.fn(() => false),
}))

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
  useReducedMotion: useReducedMotionMock,
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
  beforeEach(() => useReducedMotionMock.mockReturnValue(false))

  it("presents exact milestone copy accessibly and dismisses only its canonical ID", () => {
    const onPresented = vi.fn()

    render(
      <AchievementBanner
        achievement={firstAchievementPresentation}
        isAcknowledgementPending={false}
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

  it("anchors battle feedback to the top of its arena with compact landscape copy", () => {
    render(
      <AchievementBanner
        achievement={firstAchievementPresentation}
        isAcknowledgementPending={false}
        placement="battle"
        onPresented={vi.fn()}
      />,
    )

    const banner = screen.getByRole("complementary", {
      name: "Achievement unlocked",
    })
    expect(banner).toHaveClass("relative")
    expect(banner).not.toHaveClass("fixed")
    expect(screen.getByText("Compare your first pair of values.")).toHaveClass(
      "landscape:mt-0",
      "landscape:flex-1",
    )
  })

  it("uses canonical opaque Vivid contrast tokens for battle feedback", () => {
    render(
      <AchievementBanner
        achievement={firstAchievementPresentation}
        isAcknowledgementPending={false}
        placement="battle"
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
    expect(achievementPanel).not.toHaveClass(
      "bg-mapache-vivid-primary-yellow",
    )
  })

  it("acknowledges through semantic Motion completion without requiring dismissal", () => {
    const onPresented = vi.fn()

    render(
      <AchievementBanner
        achievement={firstAchievementPresentation}
        isAcknowledgementPending={false}
        onPresented={onPresented}
      />,
    )

    fireEvent.transitionEnd(
      screen.getByRole("complementary", { name: "Achievement unlocked" }),
    )

    expect(onPresented).toHaveBeenCalledExactlyOnceWith(firstAchievement.id)
  })

  it("removes movement under Reduced Motion while preserving readable dwell time", () => {
    useReducedMotionMock.mockReturnValue(true)

    render(
      <AchievementBanner
        achievement={firstAchievementPresentation}
        isAcknowledgementPending={false}
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
        onPresented={vi.fn()}
      />,
    )

    expect(
      screen.queryByRole("complementary", { name: "Achievement unlocked" }),
    ).not.toBeInTheDocument()
  })
})
