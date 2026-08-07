import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Progress } from "@/components/ui/progress"

describe("Progress Primitive Integration", () => {
  it("keeps its visual fill and accessible range on the same exact scale", () => {
    const { container } = render(
      <Progress aria-label="XP progress" value={3} max={4} />,
    )

    const progress = screen.getByRole("progressbar", { name: "XP progress" })
    expect(progress).toHaveAttribute("data-slot", "progress")
    expect(progress).toHaveAttribute("aria-valuenow", "3")
    expect(progress).toHaveAttribute("aria-valuemax", "4")
    expect(
      container.querySelector('[data-slot="progress-indicator"]'),
    ).toHaveStyle({ transform: "translateX(-25%)" })
  })

  it("renders an empty bar when no value has been earned", () => {
    const { container } = render(
      <Progress
        aria-label="New progress"
        indicatorClassName="bg-mapache-vivid-primary-raspberry"
      />,
    )

    expect(
      screen.getByRole("progressbar", { name: "New progress" }),
    ).toHaveClass("h-4", "border-2")
    expect(
      container.querySelector('[data-slot="progress-indicator"]'),
    ).toHaveClass("bg-mapache-vivid-primary-raspberry")
    expect(
      container.querySelector('[data-slot="progress-indicator"]'),
    ).toHaveStyle({ transform: "translateX(-100%)" })
  })
})
