import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import NativeBattleActionBar from "@/components/NativeBattleActionBar"

describe("NativeBattleActionBar", () => {
  it("exposes capability state and invokes only enabled battle actions", async () => {
    const onUndo = jest.fn()
    const onRedo = jest.fn()
    const onStop = jest.fn()
    const user = userEvent.setup()
    const { rerender } = await render(
      <NativeBattleActionBar
        canRedo
        canStop
        canUndo={false}
        onRedo={onRedo}
        onStop={onStop}
        onUndo={onUndo}
      />,
    )

    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled()

    await user.press(screen.getByRole("button", { name: "Undo" }))
    await user.press(screen.getByRole("button", { name: "Redo" }))
    await user.press(screen.getByRole("button", { name: "Stop" }))

    expect(onUndo).not.toHaveBeenCalled()
    expect(onRedo).toHaveBeenCalledTimes(1)
    expect(onStop).toHaveBeenCalledTimes(1)

    await rerender(
      <NativeBattleActionBar
        canRedo={false}
        canStop={false}
        canUndo
        onRedo={onRedo}
        onStop={onStop}
        onUndo={onUndo}
      />,
    )

    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled()

    await user.press(screen.getByRole("button", { name: "Undo" }))
    await user.press(screen.getByRole("button", { name: "Redo" }))
    await user.press(screen.getByRole("button", { name: "Stop" }))

    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onRedo).toHaveBeenCalledTimes(1)
    expect(onStop).toHaveBeenCalledTimes(1)
  })
})
