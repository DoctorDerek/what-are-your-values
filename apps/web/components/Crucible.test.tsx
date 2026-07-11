import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Crucible from "./Crucible"

describe("Crucible Component Integration", () => {
  it("updates temporal identity (data-testid) after a battle to guarantee animation resets", async () => {
    const onExitMock = vi.fn()
    const onBattleCompletedMock = vi.fn()
    const mockValuesXp = {}

    render(
      <Crucible
        valuesXp={mockValuesXp}
        onExit={onExitMock}
        onBattleCompleted={onBattleCompletedMock}
      />,
    )

    // Wait for the Crucible to initialize and display cards
    const initialCards = await screen.findAllByTestId(/card-\d+-turn-\d+/)
    expect(initialCards).toHaveLength(2)

    const initialTestIdA = initialCards[0].getAttribute("data-testid")
    const initialTestIdB = initialCards[1].getAttribute("data-testid")

    expect(initialTestIdA).toBeTruthy()
    expect(initialTestIdB).toBeTruthy()

    // Simulate clicking Card A twice via keyboard
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }))
    })

    // Assert that the battle completed callback was called
    expect(onBattleCompletedMock).toHaveBeenCalledTimes(1)

    // Wait for the next pair to render (wait for the 500ms animation to resolve)
    // We use waitFor which polls the DOM
    await waitFor(
      () => {
        const currentCards = screen.getAllByTestId(/card-\d+-turn-\d+/)
        // We know the DOM updated when the IDs change
        const currentTestIdA = currentCards[0].getAttribute("data-testid")
        if (currentTestIdA === initialTestIdA)
          throw new Error("Still animating")
      },
      { timeout: 1500 },
    )

    const nextCards = screen.getAllByTestId(/card-\d+-turn-\d+/)
    const nextTestIdA = nextCards[0].getAttribute("data-testid")
    const nextTestIdB = nextCards[1].getAttribute("data-testid")

    // The core first-principles assertion: The temporal identity MUST have mutated
    expect(nextTestIdA).not.toEqual(initialTestIdA)
    expect(nextTestIdB).not.toEqual(initialTestIdB)
  })
})
