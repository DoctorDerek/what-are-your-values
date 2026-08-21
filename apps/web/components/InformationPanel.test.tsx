import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import InformationPanel, {
  ReopenedInformationPanel,
} from "@/components/InformationPanel"

function ReopenedInformationPanelHarness() {
  const [open, setOpen] = useState(true)

  return (
    <ReopenedInformationPanel
      title="Why Values Matter"
      accessibleCloseLabel="Close Why Values Matter"
      open={open}
      primaryActionLabel="Close"
      onOpenChange={setOpen}
      onPrimaryAction={() => setOpen(false)}
    >
      <p>Long-form information</p>
    </ReopenedInformationPanel>
  )
}

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

    const primaryAction = screen.getByRole("button", { name: "Start" })
    expect(primaryAction).toHaveAttribute("data-slot", "button")
    expect(primaryAction).toHaveClass("w-full", "text-4xl", "sm:text-5xl")

    fireEvent.click(primaryAction)
    expect(onPrimaryAction).toHaveBeenCalledTimes(1)
  })

  it("dismisses reopened guidance through both visible close actions", () => {
    const { rerender } = render(<ReopenedInformationPanelHarness />)

    const dialog = screen.getByRole("dialog", { name: "Why Values Matter" })
    expect(screen.getByTestId("information-panel-body")).toHaveClass(
      "overflow-y-auto",
    )

    const accessibleCloseAction = screen.getByRole("button", {
      name: "Close Why Values Matter",
    })
    expect(accessibleCloseAction).toHaveClass("absolute", "top-4", "right-4")
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument()

    fireEvent.click(accessibleCloseAction)
    expect(
      screen.queryByRole("dialog", { name: "Why Values Matter" }),
    ).not.toBeInTheDocument()

    rerender(<ReopenedInformationPanelHarness key="footer-close" />)
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(
      screen.queryByRole("dialog", { name: "Why Values Matter" }),
    ).not.toBeInTheDocument()
  })

  it("dismisses reopened guidance through Escape", () => {
    render(<ReopenedInformationPanelHarness />)

    fireEvent.keyDown(document, { key: "Escape" })

    expect(
      screen.queryByRole("dialog", { name: "Why Values Matter" }),
    ).not.toBeInTheDocument()
  })
})
