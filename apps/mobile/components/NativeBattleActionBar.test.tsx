import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import NativeBattleActionBar from "@/components/NativeBattleActionBar"

describe("NativeBattleActionBar", () => {
  it("keeps every compact action label on one fitted line", async () => {
    await render(
      <NativeBattleActionBar
        canOpenMenu
        canRedo
        canStop
        canUndo
        onOpenMenu={jest.fn()}
        onRedo={jest.fn()}
        onStop={jest.fn()}
        onUndo={jest.fn()}
      />,
    )

    for (const actionName of ["Undo", "Redo", "Stop", "Menu"]) {
      const action = screen.getByRole("button", { name: actionName })
      const label = screen.getByText(actionName)

      expect(action.props.className).toContain("min-w-0")
      expect(action.props.className).toContain("px-2")
      expect(action.props.className).toContain("xl:px-4")
      expect(label).toHaveProp("adjustsFontSizeToFit", true)
      expect(label).toHaveProp("minimumFontScale", 0.75)
      expect(label).toHaveProp("numberOfLines", 1)
    }
  })

  it("exposes capability state and invokes only enabled battle actions", async () => {
    const onUndo = jest.fn()
    const onRedo = jest.fn()
    const onStop = jest.fn()
    const onOpenMenu = jest.fn()
    const user = userEvent.setup()
    const { rerender } = await render(
      <NativeBattleActionBar
        canOpenMenu
        canRedo
        canStop
        canUndo={false}
        onOpenMenu={onOpenMenu}
        onRedo={onRedo}
        onStop={onStop}
        onUndo={onUndo}
      />,
    )

    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Menu" })).toBeEnabled()

    await user.press(screen.getByRole("button", { name: "Undo" }))
    await user.press(screen.getByRole("button", { name: "Redo" }))
    await user.press(screen.getByRole("button", { name: "Stop" }))
    await user.press(screen.getByRole("button", { name: "Menu" }))

    expect(onUndo).not.toHaveBeenCalled()
    expect(onRedo).toHaveBeenCalledTimes(1)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onOpenMenu).toHaveBeenCalledTimes(1)

    await rerender(
      <NativeBattleActionBar
        canOpenMenu={false}
        canRedo={false}
        canStop={false}
        canUndo
        onOpenMenu={onOpenMenu}
        onRedo={onRedo}
        onStop={onStop}
        onUndo={onUndo}
      />,
    )

    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Menu" })).toBeDisabled()

    await user.press(screen.getByRole("button", { name: "Undo" }))
    await user.press(screen.getByRole("button", { name: "Redo" }))
    await user.press(screen.getByRole("button", { name: "Stop" }))
    await user.press(screen.getByRole("button", { name: "Menu" }))

    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onRedo).toHaveBeenCalledTimes(1)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onOpenMenu).toHaveBeenCalledTimes(1)
  })
})
