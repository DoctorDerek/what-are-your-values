import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import ValueLevelProgress from "@/components/ValueLevelProgress"

describe("ValueLevelProgress Component Integration", () => {
  it("presents the current level and exact progress toward the next one", () => {
    render(<ValueLevelProgress totalXp={2} />)

    expect(
      screen.getByLabelText("Level 2: 1 of 2 XP toward Level 3"),
    ).toBeVisible()
    expect(
      screen.getByRole("progressbar", { name: "XP toward Level 3" }),
    ).toHaveAttribute("aria-valuenow", "1")
    expect(screen.getByText("1/2 XP")).toBeVisible()
  })

  it("shows a new profile at the beginning of Level 1", () => {
    render(<ValueLevelProgress totalXp={0} />)

    expect(
      screen.getByLabelText("Level 1: 0 of 1 XP toward Level 2"),
    ).toBeVisible()
  })
})
