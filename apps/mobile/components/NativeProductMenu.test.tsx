import type { ProductMenuDestination } from "@game/data/src/ProductMenu"
import { describe, expect, it, jest } from "@jest/globals"
import {
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from "@testing-library/react-native"
import { useState } from "react"
import NativeProductMenu from "@/components/NativeProductMenu"

function NativeProductMenuHarness({
  contextActionLabel,
  onDestinationSelect = () => undefined,
}: {
  readonly contextActionLabel: "Close Menu" | "Resume Battle"
  readonly onDestinationSelect?: (destination: ProductMenuDestination) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <NativeProductMenu
      contextActionLabel={contextActionLabel}
      open={open}
      onDestinationSelect={onDestinationSelect}
      onOpenChange={setOpen}
    />
  )
}

describe("NativeProductMenu", () => {
  it("presents Close Menu first followed by every shipped destination in canonical order", async () => {
    await render(<NativeProductMenuHarness contextActionLabel="Close Menu" />)

    const dialog = screen.getByLabelText("Menu")
    const actionLabels = [
      "Close Menu",
      "Browse All Values",
      "Custom Values",
      "Achievements",
      "Controls",
      "Import & Export",
      "Introduction",
      "How It Works",
      "Why Values Matter",
      "Why I Made This Game",
      "Free Resources",
      "Credits & Privacy",
    ]
    const actions = within(dialog).getAllByRole("button")

    expect(actions).toHaveLength(actionLabels.length)
    actionLabels.forEach((label, index) =>
      expect(within(actions[index]).getByText(label)).toBeOnTheScreen(),
    )
  })

  it("presents Resume Battle first and reports the exact selected destination", async () => {
    const onDestinationSelect = jest.fn()
    const user = userEvent.setup()
    await render(
      <NativeProductMenuHarness
        contextActionLabel="Resume Battle"
        onDestinationSelect={onDestinationSelect}
      />,
    )

    const dialog = screen.getByLabelText("Menu")
    expect(
      within(within(dialog).getAllByRole("button")[0]).getByText(
        "Resume Battle",
      ),
    ).toBeOnTheScreen()

    await user.press(
      within(dialog).getByRole("button", { name: "Custom Values" }),
    )

    expect(onDestinationSelect).toHaveBeenCalledTimes(1)
    expect(onDestinationSelect).toHaveBeenCalledWith({
      kind: "route",
      id: "custom-values",
      label: "Custom Values",
    })
  })

  it("dismisses through context and platform-standard close actions", async () => {
    const user = userEvent.setup()
    const { container, rerender } = await render(
      <NativeProductMenuHarness contextActionLabel="Close Menu" />,
    )

    await user.press(screen.getByRole("button", { name: "Close Menu" }))
    expect(screen.queryByLabelText("Menu")).toBeNull()

    await rerender(
      <NativeProductMenuHarness
        key="platform-dismissal"
        contextActionLabel="Close Menu"
      />,
    )
    const [modal] = container.queryAll(({ type }) => type === "Modal")
    expect(modal).toBeDefined()
    await fireEvent(modal, "requestClose")

    expect(screen.queryByLabelText("Menu")).toBeNull()
  })
})
