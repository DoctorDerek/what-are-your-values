import { fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import Controls from "@/components/Controls"

function ControlsHarness() {
  const [open, setOpen] = useState(true)

  return <Controls open={open} onOpenChange={setOpen} />
}

describe("Controls Component Integration", () => {
  it("presents semantic actions before truthful web binding groups", () => {
    render(<ControlsHarness />)

    const dialog = screen.getByRole("dialog", { name: "Controls" })
    expect(screen.getByTestId("information-panel-body")).toHaveClass(
      "overflow-y-auto",
    )

    const actionsHeading = within(dialog).getByRole("heading", {
      level: 2,
      name: "Actions",
    })
    const bindingsHeading = within(dialog).getByRole("heading", {
      level: 2,
      name: "Available Controls",
    })
    expect(
      actionsHeading.compareDocumentPosition(bindingsHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const actionsSection = actionsHeading.closest("section")
    if (!actionsSection) throw new Error("Actions section is unavailable")
    expect(within(actionsSection).getByText("Select First Value")).toBeVisible()
    expect(
      within(actionsSection).getByText("Select Second Value"),
    ).toBeVisible()
    expect(
      within(actionsSection).getByText(
        "Open Menu without changing the current pair.",
      ),
    ).toBeVisible()

    const keyboardHeading = within(dialog).getByRole("heading", {
      level: 3,
      name: "Keyboard",
    })
    const keyboardSection = keyboardHeading.closest("section")
    if (!keyboardSection) throw new Error("Keyboard section is unavailable")
    expect(within(keyboardSection).getByText("1 or A")).toBeVisible()
    expect(within(keyboardSection).getByText("2 or D")).toBeVisible()
    expect(
      within(keyboardSection).getByText("Y, Ctrl+Y, or Cmd+Shift+Z"),
    ).toBeVisible()

    expect(
      within(dialog).getByRole("heading", {
        level: 3,
        name: "Touch & Pointer",
      }),
    ).toBeVisible()
    expect(within(dialog).queryByText(/controller|remap/i)).toBeNull()
  })

  it("dismisses through either visible Close action or Escape", () => {
    const { rerender } = render(<ControlsHarness />)

    const closeActions = screen.getAllByRole("button", { name: "Close" })
    expect(closeActions).toHaveLength(2)
    fireEvent.click(closeActions[0])
    expect(screen.queryByRole("dialog", { name: "Controls" })).toBeNull()

    rerender(<ControlsHarness key="footer-close" />)
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[1])
    expect(screen.queryByRole("dialog", { name: "Controls" })).toBeNull()

    rerender(<ControlsHarness key="escape-close" />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog", { name: "Controls" })).toBeNull()
  })
})
