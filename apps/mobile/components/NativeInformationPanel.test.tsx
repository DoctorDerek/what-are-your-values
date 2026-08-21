import { describe, expect, it, jest } from "@jest/globals"
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from "@testing-library/react-native"
import NativeInformationPanel, {
  ReopenedNativeInformationPanel,
} from "@/components/NativeInformationPanel"
import { Text } from "@/components/ui/text"

describe("NativeInformationPanel", () => {
  it("keeps the first-launch Start action explicit without a dismiss control", async () => {
    const onStart = jest.fn()
    const user = userEvent.setup()
    await render(
      <NativeInformationPanel
        title="Introduction"
        primaryActionLabel="Start"
        onPrimaryAction={onStart}
      >
        <Text>Approved introduction guidance.</Text>
      </NativeInformationPanel>,
    )

    expect(
      screen.getByRole("heading", { name: "Introduction" }),
    ).toBeOnTheScreen()
    expect(
      screen.getByText("Approved introduction guidance."),
    ).toBeOnTheScreen()
    expect(screen.queryByLabelText("Close Introduction")).toBeNull()

    await user.press(screen.getByRole("button", { name: "Start" }))

    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it("dismisses a named reopened panel through its X footer and platform Back", async () => {
    const onOpenChange = jest.fn()
    const user = userEvent.setup()
    const { container } = await render(
      <ReopenedNativeInformationPanel
        title="How It Works"
        accessibleCloseLabel="Close How It Works"
        primaryActionLabel="Close"
        open
        onOpenChange={onOpenChange}
        onPrimaryAction={() => onOpenChange(false)}
      >
        <Text>Approved game guidance.</Text>
      </ReopenedNativeInformationPanel>,
    )

    expect(screen.getByLabelText("How It Works")).toBeOnTheScreen()
    expect(screen.getByText("Approved game guidance.")).toBeOnTheScreen()

    await user.press(screen.getByRole("button", { name: "Close How It Works" }))
    await user.press(screen.getByRole("button", { name: "Close" }))

    const [modal] = container.queryAll(({ type }) => type === "Modal")
    expect(modal).toBeDefined()
    await fireEvent(modal, "requestClose")

    expect(onOpenChange).toHaveBeenCalledTimes(3)
    expect(onOpenChange).toHaveBeenNthCalledWith(1, false)
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false)
    expect(onOpenChange).toHaveBeenNthCalledWith(3, false)
  })
})
