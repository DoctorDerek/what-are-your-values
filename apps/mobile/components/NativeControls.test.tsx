import { describe, expect, it, jest } from "@jest/globals"
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from "@testing-library/react-native"
import NativeControls from "@/components/NativeControls"

describe("NativeControls", () => {
  it("presents semantic actions followed by touch-only native bindings", async () => {
    await render(<NativeControls open onOpenChange={() => undefined} />)

    expect(screen.getByLabelText("Controls")).toBeOnTheScreen()
    expect(screen.getByRole("heading", { name: "Actions" })).toBeOnTheScreen()
    expect(
      screen.getByRole("heading", { name: "Available Controls" }),
    ).toBeOnTheScreen()
    expect(screen.getByRole("heading", { name: "Touch" })).toBeOnTheScreen()
    expect(screen.getByText("Tap the first value card")).toBeOnTheScreen()
    expect(screen.getByText("Tap the second value card")).toBeOnTheScreen()
    expect(screen.getByText("Tap Undo")).toBeOnTheScreen()
    expect(screen.getByText("Tap Redo")).toBeOnTheScreen()
    expect(screen.queryByText("Keyboard")).toBeNull()
    expect(screen.queryByText(/controller|remap/i)).toBeNull()
  })

  it("dismisses through either Close action and platform Back", async () => {
    const onOpenChange = jest.fn()
    const user = userEvent.setup()
    const { container } = await render(
      <NativeControls open onOpenChange={onOpenChange} />,
    )

    const closeActions = screen.getAllByRole("button", { name: "Close" })
    expect(closeActions).toHaveLength(2)
    await user.press(closeActions[0])
    await user.press(closeActions[1])

    const [modal] = container.queryAll(({ type }) => type === "Modal")
    expect(modal).toBeDefined()
    await fireEvent(modal, "requestClose")

    expect(onOpenChange).toHaveBeenCalledTimes(3)
    expect(onOpenChange).toHaveBeenNthCalledWith(1, false)
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false)
    expect(onOpenChange).toHaveBeenNthCalledWith(3, false)
  })
})
