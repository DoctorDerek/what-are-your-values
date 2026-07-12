import {
  act,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Crucible from "./Crucible"

describe("Crucible Component Integration", () => {
  it("forces a node remount on consecutive turns to guarantee animation resets", async () => {
    const onExitMock = vi.fn()
    const onBattleCompletedMock = vi.fn()
    const mockValuesXp = {}
    const mockStorageAdapter = {
      getItem: vi.fn(() => null), // Returns null so it generates a fresh queue
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }

    render(
      <Crucible
        valuesXp={mockValuesXp}
        storageAdapter={mockStorageAdapter}
        onExit={onExitMock}
        onBattleCompleted={onBattleCompletedMock}
      />,
    )

    // Wait for the game to initialize and render the combat interface
    const cardAIndicator = await screen.findByText("[1 / A]")
    const cardBIndicator = await screen.findByText("[2 / D]")

    // We capture the specific DOM nodes wrapping the cards.
    // By testing trophy principles, we just find the closest button or generic container,
    // but these are just divs with onClick handlers (role="button" ideally, but for now we find closest div).
    const initialCardA = cardAIndicator.closest("div")
    const initialCardB = cardBIndicator.closest("div")

    expect(initialCardA).toBeInTheDocument()
    expect(initialCardB).toBeInTheDocument()

    // Simulate the user selecting Card A instantly via keyboard
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }))
    })

    // Assert the domain logic executes
    expect(onBattleCompletedMock).toHaveBeenCalledTimes(1)

    // The First-Principles core assertion:
    // The previous nodes MUST be destroyed and removed from the DOM to force Framer Motion
    // to play the exit and enter animations. If the keys mutated, these nodes are gone natively.
    await waitForElementToBeRemoved(initialCardA, { timeout: 1500 })

    // Verify the new cards have rendered and are distinct DOM nodes
    const newCardAIndicator = await screen.findByText("[1 / A]")
    const newCardA = newCardAIndicator.closest("div")

    // Mathematically proves React Reconciliation unmounted and remounted the nodes
    expect(newCardA).not.toBe(initialCardA)
  })
})
