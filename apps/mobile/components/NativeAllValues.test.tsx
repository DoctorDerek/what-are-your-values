import { createActiveDeck, type ActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import {
  createInitialValueProgress,
  createValueProgress,
} from "@game/data/src/ValueProgress"
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

function createRankedValuesWithEvidence() {
  const activeDeck = createActiveDeck([])
  const progressById = new Map(createInitialValueProgress(activeDeck))
  const firstValueId = activeDeck.valueIds[0]
  if (!firstValueId) throw new Error("Canonical test value is unavailable")

  progressById.set(
    firstValueId,
    createValueProgress(firstValueId, {
      totalXp: 4,
      profileWins: 1,
      profileComparisons: 1,
      currentCycleWins: 1,
    }),
  )

  return rankValues(activeDeck, progressById)
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

  it("adds a complete Custom Value through the composed builder", async () => {
    const callbacks = createCallbacks()
    const user = userEvent.setup()
    const rankedValues = createRankedValues(createActiveDeck([])).slice(0, 3)
    await render(<NativeAllValues {...callbacks} rankedValues={rankedValues} />)

    await user.press(screen.getByRole("button", { name: "Add Custom Value" }))
    await user.type(screen.getByLabelText("Value Name"), "Mapachecraft")
    await user.type(
      screen.getByLabelText("What This Value Means to Me"),
      "To solve meaningful problems with playful ingenuity.",
    )
    await user.press(screen.getByRole("button", { name: "Save Value" }))

    expect(callbacks.onAddCustomValue).toHaveBeenCalledWith(
      "Mapachecraft",
      "To solve meaningful problems with playful ingenuity.",
    )
  })

  it("updates a Custom Value only after composed edit review", async () => {
    const callbacks = createCallbacks()
    const user = userEvent.setup()
    const activeDeck = createIngenuityDeck()
    const ingenuity = activeDeck.customValues[0]
    const rankedValues = createRankedValues(activeDeck).filter(
      ({ definition }) => definition.id === ingenuity.id,
    )
    await render(<NativeAllValues {...callbacks} rankedValues={rankedValues} />)

    await user.press(
      within(screen.getByLabelText("Ingenuity details")).getByRole("button", {
        name: "Edit",
      }),
    )
    const definition = screen.getByLabelText("What This Value Means to Me")
    await user.clear(definition)
    await user.type(definition, "Resourceful and original problem solving.")
    await user.press(screen.getByRole("button", { name: "Review Update" }))
    await user.press(screen.getByRole("button", { name: "Update Value" }))

    expect(callbacks.onUpdateCustomValue).toHaveBeenCalledWith(
      ingenuity.id,
      "Ingenuity",
      "Resourceful and original problem solving.",
    )
  })

  it("deletes exactly the confirmed Custom Value", async () => {
    const callbacks = createCallbacks()
    const user = userEvent.setup()
    const activeDeck = createIngenuityDeck()
    const ingenuity = activeDeck.customValues[0]
    const rankedValues = createRankedValues(activeDeck).filter(
      ({ definition }) => definition.id === ingenuity.id,
    )
    await render(<NativeAllValues {...callbacks} rankedValues={rankedValues} />)

    await user.press(
      within(screen.getByLabelText("Ingenuity details")).getByRole("button", {
        name: "Delete",
      }),
    )
    await user.press(screen.getByRole("button", { name: "Remove Value" }))

    expect(callbacks.onDeleteCustomValue).toHaveBeenCalledWith(ingenuity.id)
  })

  it("closes the builder and reveals an existing matching value", async () => {
    const callbacks = createCallbacks()
    const user = userEvent.setup()
    const rankedValues = createRankedValues(createActiveDeck([])).filter(
      ({ definition }) =>
        definition.kind === "canonical" && definition.englishName === "Health",
    )
    await render(<NativeAllValues {...callbacks} rankedValues={rankedValues} />)

    const search = screen.getByLabelText("Search All Values")
    await user.type(search, "Health")
    await user.press(screen.getByRole("button", { name: "Add Custom Value" }))
    await user.type(screen.getByLabelText("Value Name"), "Health")
    await user.press(screen.getByRole("button", { name: "Open Health" }))

    expect(screen.queryByLabelText("Add Custom Value")).not.toBeOnTheScreen()
    expect(screen.getByLabelText("Health details")).toBeOnTheScreen()
    expect(search).toHaveDisplayValue("")
  })

  it("separates the evidence-ranked Top Five from every remaining value", async () => {
    const callbacks = createCallbacks()
    const rankedValues = createRankedValuesWithEvidence().slice(0, 6)
    await render(<NativeAllValues {...callbacks} rankedValues={rankedValues} />)

    expect(screen.getAllByText("Top Five")).toHaveLength(1)
    expect(screen.getAllByText("All Other Values")).toHaveLength(1)
    expect(screen.getByLabelText("Rank 1")).toBeOnTheScreen()
    expect(screen.getByLabelText("Rank 6")).toBeOnTheScreen()
  })

  it("explains that a failed save preserved the current data and draft", async () => {
    const callbacks = createCallbacks()
    const rankedValues = createRankedValues(createActiveDeck([])).slice(0, 3)
    await render(
      <NativeAllValues
        {...callbacks}
        persistenceIssue="Native storage write failed"
        rankedValues={rankedValues}
      />,
    )

    expect(screen.getByLabelText("Custom Value save failed")).toHaveProp(
      "accessibilityRole",
      "alert",
    )
    expect(screen.getByText("That change wasn’t saved.")).toBeOnTheScreen()
    expect(
      screen.getByText(
        "Your current data and draft are unchanged. Review them and try again.",
      ),
    ).toBeOnTheScreen()
  })
})
