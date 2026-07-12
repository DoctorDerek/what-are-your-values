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
      getItem: vi.fn(() => null),
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

    const cardAIndicator = await screen.findByText("[1 / A]")
    const cardBIndicator = await screen.findByText("[2 / D]")

    const initialCardA = cardAIndicator.closest("div")
    const initialCardB = cardBIndicator.closest("div")

    expect(initialCardA).toBeInTheDocument()
    expect(initialCardB).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }))
    })

    expect(onBattleCompletedMock).toHaveBeenCalledTimes(1)

    await waitForElementToBeRemoved(initialCardA, { timeout: 1500 })

    const newCardAIndicator = await screen.findByText("[1 / A]")
    const newCardA = newCardAIndicator.closest("div")

    expect(newCardA).not.toBe(initialCardA)
  })

  it("focuses a card on first click and selects it as winner on second click", async () => {
    const onExitMock = vi.fn()
    const onBattleCompletedMock = vi.fn()
    const mockValuesXp = { 1: 50, 2: 25 }
    const mockStorageAdapter = {
      getItem: vi.fn(() => JSON.stringify([[1, 2]])),
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

    const cardAIndicator = await screen.findByText("[1 / A]")
    const cardA = cardAIndicator.closest("div")
    if (!cardA) throw new Error("Card A not found")

    act(() => {
      cardA.click()
    })
    
    expect(cardA.className).toContain("ring-8")
    expect(onBattleCompletedMock).not.toHaveBeenCalled()

    act(() => {
      cardA.click()
    })

    expect(onBattleCompletedMock).toHaveBeenCalledTimes(1)
    expect(onBattleCompletedMock).toHaveBeenCalledWith(1, 2, expect.any(Number))
  })
})
