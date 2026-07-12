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
  it("prevents animation regression by forcing remount when the same value appears consecutively on the same side", async () => {
    const onExitMock = vi.fn()
    const onBattleCompletedMock = vi.fn()
    const mockValuesXp = {}
    
    // Explicitly set the queue to [ [1, 3], [1, 2] ] 
    // This means ID 1 will be on the left ("Card A") for two consecutive turns
    const mockStorageAdapter = {
      getItem: vi.fn(() => JSON.stringify([[1, 3], [1, 2]])),
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

    // Complete the first battle (selecting Card A)
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }))
    })

    expect(onBattleCompletedMock).toHaveBeenCalledTimes(1)

    // Wait for the old node to be unmounted due to the key prop change
    await waitForElementToBeRemoved(initialCardA, { timeout: 1500 })

    // Find the newly rendered Card A (which still represents ID 1)
    const newCardAIndicator = await screen.findByText("[1 / A]")
    const newCardA = newCardAIndicator.closest("div")

    // The core regression test: it MUST be a new DOM node, forcing a sterile animation remount
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

  it("navigates via arrow keys and selects via enter/space", async () => {
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
    const cardBIndicator = await screen.findByText("[2 / D]")
    const cardA = cardAIndicator.closest("div")
    const cardB = cardBIndicator.closest("div")
    
    if (!cardA || !cardB) throw new Error("Cards not found")

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
    })
    
    expect(cardB.className).toContain("ring-8")

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }))
    })

    expect(cardA.className).toContain("ring-8")

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    })
    
    expect(onExitMock).toHaveBeenCalledTimes(1)

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
    })

    expect(onBattleCompletedMock).toHaveBeenCalledTimes(1)
    expect(onBattleCompletedMock).toHaveBeenCalledWith(1, 2, expect.any(Number))
  })
})
