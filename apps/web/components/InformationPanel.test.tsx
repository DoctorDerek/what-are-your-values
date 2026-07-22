import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import InformationPanel from "@/components/InformationPanel"

describe("InformationPanel Component Integration", () => {
  it("keeps long-form content separate from its always-reachable action", () => {
    const onPrimaryAction = vi.fn()

    render(
      <InformationPanel
        title="Introduction"
        primaryActionLabel="Start"
        onPrimaryAction={onPrimaryAction}
      >
        <p>Long-form information</p>
      </InformationPanel>,
    )

    expect(
      screen.getByRole("main").querySelector("section"),
    ).toHaveAccessibleName("Introduction")
    expect(screen.getByRole("main")).not.toHaveClass(
      "overscroll-none",
      "select-none",
    )
    expect(screen.getByTestId("information-panel-body")).toHaveClass(
      "overflow-y-auto",
    )

    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    expect(onPrimaryAction).toHaveBeenCalledTimes(1)
  })
})
