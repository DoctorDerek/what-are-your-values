import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import BattleActionBar from "./BattleActionBar"

describe("Battle Action Bar", () => {
  it("exposes real disabled history actions and an available Stop action", () => {
    const onOpenMenu = vi.fn()
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    const onStop = vi.fn()

    const { rerender } = render(
      <BattleActionBar
        canOpenMenu
        canUndo={false}
        canRedo={false}
        canStop
        onOpenMenu={onOpenMenu}
        onUndo={onUndo}
        onRedo={onRedo}
        onStop={onStop}
      />,
    )

    const undo = screen.getByRole("button", { name: "Undo" })
    const redo = screen.getByRole("button", { name: "Redo" })
    const menu = screen.getByRole("button", { name: "Menu" })
    expect(undo).toBeDisabled()
    expect(redo).toBeDisabled()
    for (const shortcut of ["[Z]", "[Y]", "[ESC]"]) {
      expect(screen.getByText(shortcut)).toHaveClass("hidden", "xl:inline")
    }
    fireEvent.click(undo)
    fireEvent.click(redo)
    expect(onUndo).not.toHaveBeenCalled()
    expect(onRedo).not.toHaveBeenCalled()
    fireEvent.click(menu)
    expect(onOpenMenu).toHaveBeenCalledOnce()

    const stop = screen.getByRole("button", { name: "Stop" })
    expect(stop).toHaveClass("text-black")
    fireEvent.click(stop)
    expect(onStop).toHaveBeenCalledTimes(1)

    rerender(
      <BattleActionBar
        canOpenMenu={false}
        canUndo
        canRedo
        canStop={false}
        onOpenMenu={onOpenMenu}
        onUndo={onUndo}
        onRedo={onRedo}
        onStop={onStop}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    fireEvent.click(screen.getByRole("button", { name: "Redo" }))
    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    fireEvent.click(screen.getByRole("button", { name: "Stop" }))
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onRedo).toHaveBeenCalledTimes(1)
    expect(onOpenMenu).toHaveBeenCalledTimes(1)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Menu" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled()
  })
})
