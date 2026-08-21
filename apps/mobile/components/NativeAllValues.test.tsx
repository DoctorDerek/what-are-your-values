import { createActiveDeck, type ActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import { createInitialValueProgress } from "@game/data/src/ValueProgress"
import { rankValues } from "@game/data/src/ValueRanking"
import { describe, expect, it, jest } from "@jest/globals"
import {
  render,
  screen,
  userEvent,
  within,
} from "@testing-library/react-native"
import NativeAllValues from "@/components/NativeAllValues"

function createRankedValues(activeDeck: ActiveDeck) {
  return rankValues(activeDeck, createInitialValueProgress(activeDeck))
}

function createIngenuityDeck() {
  return createActiveDeck([
    Object.freeze({
      kind: "custom",
      id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
      name: "Ingenuity",
      definition: "Ability to solve problems creatively.",
      creationOrdinal: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }) satisfies CustomValueDefinition,
  ])
}

function createCallbacks() {
  return {
    onAddCustomValue: jest.fn(),
    onClose: jest.fn(),
    onDeleteCustomValue: jest.fn(),
    onOpenMenu: jest.fn(),
    onUpdateCustomValue: jest.fn(),
  }
}

describe("NativeAllValues", () => {
  it("routes Menu and Close when no Custom Value work is pending", async () => {
    const callbacks = createCallbacks()
    const user = userEvent.setup()
    const rankedValues = createRankedValues(createActiveDeck([])).slice(0, 3)
    await render(<NativeAllValues {...callbacks} rankedValues={rankedValues} />)

    const menu = screen.getByRole("button", { name: "Menu" })
    const close = screen.getByRole("button", { name: "Close" })
    expect(menu).toBeEnabled()
    expect(close).toBeEnabled()

    await user.press(menu)
    await user.press(close)

    expect(callbacks.onOpenMenu).toHaveBeenCalledTimes(1)
    expect(callbacks.onClose).toHaveBeenCalledTimes(1)
  })

  it("blocks navigation for an add draft and restores it after Cancel", async () => {
    const callbacks = createCallbacks()
    const user = userEvent.setup()
    const rankedValues = createRankedValues(createActiveDeck([])).slice(0, 3)
    await render(
      <NativeAllValues
        {...callbacks}
        openCustomValueBuilder
        rankedValues={rankedValues}
      />,
    )

    const menu = screen.getByRole("button", { name: "Menu" })
    const close = screen.getByRole("button", { name: "Close" })
    expect(menu).toBeDisabled()
    expect(close).toBeDisabled()

    await user.press(menu)
    await user.press(close)
    expect(callbacks.onOpenMenu).not.toHaveBeenCalled()
    expect(callbacks.onClose).not.toHaveBeenCalled()

    await user.press(screen.getByRole("button", { name: "Cancel" }))
    expect(menu).toBeEnabled()
    expect(close).toBeEnabled()
  })

  it("blocks navigation through edit drafts and delete confirmations", async () => {
    const callbacks = createCallbacks()
    const user = userEvent.setup()
    const activeDeck = createIngenuityDeck()
    const rankedValues = createRankedValues(activeDeck).filter(
      ({ definition }) => definition.id === activeDeck.customValues[0].id,
    )
    await render(<NativeAllValues {...callbacks} rankedValues={rankedValues} />)

    const menu = screen.getByRole("button", { name: "Menu" })
    const close = screen.getByRole("button", { name: "Close" })
    const ingenuity = screen.getByLabelText("Ingenuity details")

    await user.press(within(ingenuity).getByRole("button", { name: "Edit" }))
    expect(menu).toBeDisabled()
    expect(close).toBeDisabled()
    await user.press(screen.getByRole("button", { name: "Cancel" }))
    expect(menu).toBeEnabled()
    expect(close).toBeEnabled()

    await user.press(within(ingenuity).getByRole("button", { name: "Delete" }))
    expect(screen.getByLabelText("Remove Ingenuity?")).toBeOnTheScreen()
    expect(menu).toBeDisabled()
    expect(close).toBeDisabled()
    await user.press(screen.getByRole("button", { name: "Cancel" }))
    expect(menu).toBeEnabled()
    expect(close).toBeEnabled()
  })

  it("keeps navigation inert while persistence is pending", async () => {
    const callbacks = createCallbacks()
    const user = userEvent.setup()
    const rankedValues = createRankedValues(createActiveDeck([])).slice(0, 3)
    await render(
      <NativeAllValues
        {...callbacks}
        isPersistencePending
        rankedValues={rankedValues}
      />,
    )

    const menu = screen.getByRole("button", { name: "Menu" })
    const close = screen.getByRole("button", { name: "Close" })
    expect(menu).toBeDisabled()
    expect(close).toBeDisabled()

    await user.press(menu)
    await user.press(close)

    expect(callbacks.onOpenMenu).not.toHaveBeenCalled()
    expect(callbacks.onClose).not.toHaveBeenCalled()
  })
})
