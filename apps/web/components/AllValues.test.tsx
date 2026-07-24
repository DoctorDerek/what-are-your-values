import { createActiveDeck, type ActiveDeck } from "@game/data/src/ActiveDeck"
import { CANONICAL_VALUES } from "@game/data/src/CanonicalValues"
import {
  createCustomValueId,
  getValueDisplayDefinition,
  getValueDisplayName,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import { createInitialValueProgress } from "@game/data/src/ValueProgress"
import { rankValues } from "@game/data/src/ValueRanking"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import AllValues from "./AllValues"

function createRankedValues(activeDeck: ActiveDeck) {
  return rankValues(activeDeck, createInitialValueProgress(activeDeck))
}

function createActiveDeckWithIngenuity() {
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

describe("All Values Component Integration", () => {
  it("shows the complete fresh canonical ranking without fabricating a Top Five", () => {
    const rankedValues = createRankedValues(createActiveDeck([]))

    const onAddCustomValue = vi.fn()
    const onUpdateCustomValue = vi.fn()

    render(
      <AllValues
        rankedValues={rankedValues}
        onClose={vi.fn()}
        onAddCustomValue={onAddCustomValue}
        onUpdateCustomValue={onUpdateCustomValue}
      />,
    )

    expect(
      screen.getByRole("heading", { name: "All Values", level: 1 }),
    ).toBeVisible()
    expect(
      screen.getByText(`${CANONICAL_VALUES.length} Active Values`),
    ).toBeVisible()
    expect(screen.getAllByRole("listitem")).toHaveLength(
      CANONICAL_VALUES.length,
    )
    expect(screen.queryByText("Top Five")).not.toBeInTheDocument()
    expect(
      screen.getByText(
        `“${getValueDisplayDefinition(rankedValues[0].definition)}”`,
      ),
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument()
  })

  it("adds a custom value with required callbacks and fields", () => {
    const rankedValues = createRankedValues(createActiveDeck([]))
    const onAddCustomValue = vi.fn()
    const onUpdateCustomValue = vi.fn()

    render(
      <AllValues
        rankedValues={rankedValues}
        onClose={vi.fn()}
        onAddCustomValue={onAddCustomValue}
        onUpdateCustomValue={onUpdateCustomValue}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Add Custom Value" }))
    fireEvent.change(screen.getByLabelText("Custom Value Name"), {
      target: { value: "   Ingenuity   " },
    })
    fireEvent.change(screen.getByLabelText("Custom Value Definition"), {
      target: { value: "  Inventions and original ideas matter. " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Custom Value" }))

    expect(onAddCustomValue).toHaveBeenCalledWith(
      "Ingenuity",
      "Inventions and original ideas matter.",
    )
  })

  it("edits a custom value and emits the full replacement payload", () => {
    const activeDeck = createActiveDeckWithIngenuity()
    const rankedValues = createRankedValues(activeDeck)
    const onAddCustomValue = vi.fn()
    const onUpdateCustomValue = vi.fn()

    render(
      <AllValues
        rankedValues={rankedValues}
        onClose={vi.fn()}
        onAddCustomValue={onAddCustomValue}
        onUpdateCustomValue={onUpdateCustomValue}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Edit" }))

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: " Curiosity Engine " },
    })
    fireEvent.change(screen.getByLabelText("Definition"), {
      target: { value: "  A drive to explore how things connect. " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(onUpdateCustomValue).toHaveBeenCalledWith(
      activeDeck.customValues[0].id,
      "Curiosity Engine",
      "A drive to explore how things connect.",
    )
    expect(onAddCustomValue).not.toHaveBeenCalled()
  })

  it("filters without reordering ranks and restores the complete list", () => {
    const activeDeck = createActiveDeck([])
    const rankedValues = createRankedValues(activeDeck)
    const expectedMatches = rankedValues.filter(({ definition }) =>
      getValueDisplayName(definition).toLocaleLowerCase().includes("health"),
    )

    render(
      <AllValues
        rankedValues={rankedValues}
        onClose={vi.fn()}
        onAddCustomValue={vi.fn()}
        onUpdateCustomValue={vi.fn()}
      />,
    )

    const search = screen.getByRole("searchbox", { name: "Search Values" })
    fireEvent.change(search, { target: { value: "health" } })

    expect(screen.getAllByRole("listitem")).toHaveLength(expectedMatches.length)
    expectedMatches.forEach(({ rank, definition }) => {
      expect(screen.getByLabelText(`Rank ${rank}`)).toBeVisible()
      expect(screen.getByText(getValueDisplayName(definition))).toBeVisible()
    })

    fireEvent.change(search, { target: { value: "" } })
    expect(screen.getAllByRole("listitem")).toHaveLength(
      CANONICAL_VALUES.length,
    )
  })

  it("matches definition text when filtering", () => {
    const activeDeck = createActiveDeck([])
    const rankedValues = createRankedValues(activeDeck)
    const definitionSearchText = rankedValues[0].definition.sourceDefinition
      .slice(0, 12)
      .toLocaleLowerCase()
    const expectedMatches = rankedValues.filter(({ definition }) =>
      getValueDisplayDefinition(definition)
        .toLocaleLowerCase()
        .includes(definitionSearchText),
    )

    render(
      <AllValues
        rankedValues={rankedValues}
        onClose={vi.fn()}
        onAddCustomValue={vi.fn()}
        onUpdateCustomValue={vi.fn()}
      />,
    )

    const search = screen.getByRole("searchbox", { name: "Search Values" })
    fireEvent.change(search, { target: { value: definitionSearchText } })

    expect(screen.getAllByRole("listitem")).toHaveLength(expectedMatches.length)
    expectedMatches.forEach(({ rank, definition }) => {
      expect(screen.getByLabelText(`Rank ${rank}`)).toBeVisible()
      expect(screen.getByText(getValueDisplayName(definition))).toBeVisible()
    })
  })

  it("marks the earned Top Five and closes without changing data", () => {
    const activeDeck = createActiveDeck([])
    const rankedValues = rankValues(
      activeDeck,
      createInitialValueProgress(activeDeck),
    )

    const onClose = vi.fn()
    render(
      <AllValues
        rankedValues={rankedValues.map((value, index) => {
          if (index < 1) {
            return {
              ...value,
              progress: {
                ...value.progress,
                totalXp: value.progress.totalXp + 2,
                profileComparisons: value.progress.profileComparisons + 2,
                profileWins: value.progress.profileWins + 2,
              },
            }
          }
          return value
        })}
        onClose={onClose}
        onAddCustomValue={vi.fn()}
        onUpdateCustomValue={vi.fn()}
      />,
    )

    expect(screen.getAllByText("Top Five")).toHaveLength(5)
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("closes through Escape without changing the visible ranking first", () => {
    const activeDeck = createActiveDeck([])
    const rankedValues = createRankedValues(activeDeck)
    const onClose = vi.fn()

    render(
      <AllValues
        rankedValues={rankedValues}
        onClose={onClose}
        onAddCustomValue={vi.fn()}
        onUpdateCustomValue={vi.fn()}
      />,
    )

    expect(screen.getAllByRole("listitem")).toHaveLength(
      CANONICAL_VALUES.length,
    )
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
