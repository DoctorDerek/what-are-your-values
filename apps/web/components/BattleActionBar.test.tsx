import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import BattleActionBar from "./BattleActionBar"

describe("Battle Action Bar", () => {
  it("exposes real disabled history actions and an available Stop action", () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    const onStop = vi.fn()

    const { rerender } = render(
      <BattleActionBar
        canUndo={false}
        canRedo={false}
        canStop
        onUndo={onUndo}
        onRedo={onRedo}
        onStop={onStop}
      />,
    )

    const undo = screen.getByRole("button", { name: "Undo" })
    const redo = screen.getByRole("button", { name: "Redo" })
    expect(undo).toBeDisabled()
    expect(redo).toBeDisabled()
    for (const shortcut of ["[Z]", "[Y]", "[ESC]"]) {
      expect(screen.getByText(shortcut)).toHaveClass("hidden", "sm:inline")
    }
    fireEvent.click(undo)
    fireEvent.click(redo)
    expect(onUndo).not.toHaveBeenCalled()
    expect(onRedo).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Stop" }))
    expect(onStop).toHaveBeenCalledTimes(1)

    rerender(
      <BattleActionBar
        canUndo
        canRedo
        canStop={false}
        onUndo={onUndo}
        onRedo={onRedo}
        onStop={onStop}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    fireEvent.click(screen.getByRole("button", { name: "Redo" }))
    fireEvent.click(screen.getByRole("button", { name: "Stop" }))
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onRedo).toHaveBeenCalledTimes(1)
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled()
  })
})
