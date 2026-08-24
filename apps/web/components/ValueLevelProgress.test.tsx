import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import ValueLevelProgress from "@/components/ValueLevelProgress"

describe("ValueLevelProgress Component Integration", () => {
  it("presents the current level and exact progress toward the next one", () => {
    render(<ValueLevelProgress totalXp={4} />)

    expect(
      screen.getByLabelText("Level 3: 0 of 2 XP toward Level 4"),
    ).toBeVisible()
    const progress = screen.getByRole("progressbar", {
      name: "XP toward Level 4",
    })
    expect(progress).toHaveAttribute("data-slot", "progress")
    expect(progress).toHaveAttribute("aria-valuenow", "0")
    expect(progress).toHaveAttribute("aria-valuemax", "2")
    expect(screen.getByText("0/2 XP")).toBeVisible()
  })

  it("shows a new profile at the beginning of Level 1", () => {
    render(<ValueLevelProgress totalXp={0} />)

    const progress = screen.getByLabelText("Level 1: 0 of 2 XP toward Level 2")

    expect(progress).toBeVisible()
    expect(progress).toHaveClass(
      "w-full",
      "min-w-0",
      "basis-full",
      "xl:w-auto",
      "xl:min-w-44",
      "xl:basis-auto",
    )
    expect(progress).not.toHaveClass(
      "sm:w-auto",
      "sm:min-w-44",
      "sm:basis-auto",
    )
  })
})
